var logger = require('logmgr').getLogger('pastry/leafset');
var node = require('core/node');
var langutil = require('common/langutil');
var ringutil = require('common/ringutil');
var bigint = require('thirdparty/bigint');
var mod_id = require('common/id');
var util = require('util');
var events = require('events');

Leafset = function() {	
	this.leafsetSize = 20;
	this.timedOutPeerIntervalMsec = 35000;
	this.departedPeerRetentionIntervalMsec = 60*1000;
	this.candidatePeerRetentionIntervalMsec = 60*1000;
	this._leafset = {};		// internal representation
	this._deadset = {};		// for recently departed nodes, to stop having them re-added
	this._candidateset = {};// for recently discovered nodes, which get 'promoted' into leafset once confirmed alive	
};
util.inherits(Leafset, events.EventEmitter);

Leafset.prototype.compressedLeafset = function() {
	var res = {};
	this.each(function(id, item) {
		res[id] = item.ap;
	});
	return res;
};

Leafset.prototype.each = function(callback) {
	for (var id in this._leafset) {
		callback(id, this._leafset[id]);
	}
};

Leafset.prototype.eachCandidate = function(callback) {
	for (var id in this._candidateset) {
		callback(id, this._candidateset[id]);
	}
};

Leafset.prototype.peer = function(id) {
	return this._leafset[id];
};

//
// add given peer directly to leafset, disregarding dead and candidate sets
Leafset.prototype.updateWithKnownGood = function(a, b) {
	var self = this;
	// leafset size sanity check until we do something more permanent: we really
	// want leafset size to be an even number
	if (self.leafsetSize % 2 !== 0)
		throw new Error('Oops - odd leafset size! Even only please.');
	
	self._update(a,b, function(id, addrPort) {
		if (self._deadset[id] !== undefined) {
			logger.verbose('Found known good peer ' + id + ' in dead set, removing so it can be moved to leafset');
			delete self._deadset[id];
		}
		if (self._candidateset[id] !== undefined) {
			logger.verbose('Found known good peer ' + id + ' in candidate set, removing so it can be moved to leafset');
			delete self._candidateset[id];
		}
		
		if (self._leafset[id]) {
			logger.verbose('Updating node ' + id + ' in leafset');
			self._put(id, addrPort);
		} else if (Object.keys(self._leafset).length < self.leafsetSize) {
			logger.verbose('Adding node ' + id + ' to leafset');
			self._put(id, addrPort, true);
		} else {
			var sorted = ringutil.sortByIncreasingDistance(node.nodeId, Object.keys(self._leafset).concat([id]));
			if (sorted.indexOf(id) === self.leafsetSize / 2) 
				return;

			var idToReplace = sorted[self.leafsetSize / 2];
			logger.verbose('Evicting node ' + idToReplace + ' from leafset and replacing with ' + id);
			delete self._leafset[idToReplace];
			self._put(id, addrPort, true);
		}
	});
};

//
// Add any new, unknown peers that are potentially leafset material to the candidate set
Leafset.prototype.updateWithProvisional = function(a,b) {
	var self = this;
	self._update(a,b, function(id, addrPort) {
		if (self._deadset[id]) {
			logger.verbose('Ignoring dead peer ' + id);
			return;
		}
		
		if (self._leafset[id])
			return;
		if (self._candidateset[id]) {
			if (self._candidateset[id].ap === addrPort)
				return;
			else
				logger.verbose('Found provisional peer ' + id + ' with different ip (' + addrPort
						+ ') to that already seen (' + self._candidateset[id].ap + ')');
		}
		
		if (Object.keys(self._leafset).length >= self.leafsetSize) {
			// if this peer is not within leafset range on either side, we don't care about it
			var sorted = ringutil.sortByIncreasingDistance(node.nodeId, Object.keys(self._leafset).concat([id]));
			if (sorted.indexOf(id) === self.leafsetSize / 2) 
				return;
		}

		logger.verbose('Adding node ' + id + ' to candidateset');
		self._candidateset[id] = {
			ap : addrPort,
			foundAt : Date.now()
		};
	});
};

Leafset.prototype._update = function(a, b, nodeHandler) {
	if (!a)
		return;
	
	var nodes = a;
	if (typeof(a) === 'string') {
		nodes = {};
		nodes[a] = b;
	}
	
	for (var id in nodes) {
		if (id === node.nodeId) {
			continue;				
		}
		
		nodeHandler(id, nodes[id]);
	}
};

Leafset.prototype._put = function(id, addrPort, raiseEvent) {
	var existing = this._leafset[id] === undefined ? {} : this._leafset[id]; 
	this._leafset[id] = langutil.extend(existing, {
		ap : addrPort,
		lastHeartbeatReceived : Date.now()
	});
	
	if (raiseEvent === true)
		this.emit('peer-arrived', id);
};

Leafset.prototype.clearExpiredDeadAndCandidatePeers = function() {
	for (var id in this._deadset) {
		if (this._deadset[id].deadAt < (Date.now() - this.departedPeerRetentionIntervalMsec))
			delete this._deadset[id];
	}
	for (var id in this._candidateset) {
		if (this._candidateset[id].foundAt < (Date.now() - this.candidatePeerRetentionIntervalMsec))
			delete this._candidateset[id];
	}
};

Leafset.prototype.clearTimedOutPeers = function() {
	var self = this;
	self.each(function(id, item) {
		if (item.lastHeartbeatReceived < (Date.now() - self.timedOutPeerIntervalMsec)) {
			logger.verbose('Found timed out peer ' + id + ' (' + item.ap + ')');
			self.removePeer(id);				
		}
	});
};

Leafset.prototype.removePeer = function(id) {
	logger.verbose('Removing peer ' + id + ' from leafset');
	var removed = false;
	if (this._leafset[id] !== undefined) {
		removed = true;
		this._deadset[id] = this._leafset[id];
		this._deadset[id].deadAt = Date.now();			
	}
	delete this._leafset[id];
	
	if (removed)
		this.emit('peer-departed', id);
};

Leafset.prototype.reset = function() {
	this._leafset = {};
	this._deadset = {};
	this._candidateset = {};
};

//
// Gets node id nearest to the given id, without looking 'outside' the leafset range.
// If this is not possible, returns undefined
Leafset.prototype.getRoutingHop = function(id) {
	var leafsetIds = Object.keys(this._leafset).concat([node.nodeId]);
	
	if (this.isWithinLeafsetRange(id)) {
		var res = ringutil.getNearestId(id, leafsetIds);
		if (res.nearest) {
			if (res.nearest === node.nodeId) {
				return {
					id : res.nearest
				};
			} else {
				return{
					id   : res.nearest,
					addr : this._leafset[res.nearest].ap.split(':')[0],
					port : this._leafset[res.nearest].ap.split(':')[1]
				};
			}
		}
	}
	return undefined;
};

Leafset.prototype.isWithinLeafsetRange = function(id) {
	var currentLeafsetSize = Object.keys(this._leafset).length;
	if (currentLeafsetSize < 1)
		return false;
	
	// if id matches one of the leafset nodes exactly, we return it immediately; this is slightly
	// more efficient, but also saves having to handle duplicate ids when doing the sort just below
	if (Object.keys(this._leafset).indexOf(id) > -1)
		return true;

	var sorted = ringutil.sortByIncreasingDistance(node.nodeId, Object.keys(this._leafset).concat([id]));
	var idPos = sorted.indexOf(id);
	return idPos < this.leafsetSize / 2 || idPos > currentLeafsetSize - this.leafsetSize / 2; 
};

// TODO: replace use of this func elsewhere
Leafset.prototype.isThisNodeNearestTo = function(id) {
	return ringutil.amINearest(id, node.nodeId, Object.keys(this._leafset));
};

//
// return 'edge' leafset peers in clockwise and anti-clockwise direction
Leafset.prototype.getEdgePeers = function() {
	if (Object.keys(this._leafset).length < 1) {
		return {
			cw : node.nodeId,
			ccw : node.nodeId
		};
	}
	
	var sorted = ringutil.sortByIncreasingDistance(node.nodeId, Object.keys(this._leafset));
	var cwIndex = Math.min(this.leafsetSize / 2 - 1, sorted.length-1);
	var ccwIndex = Math.max(sorted.length - this.leafsetSize / 2, 0);
	return {
		cw : sorted[cwIndex],
		ccw: sorted[ccwIndex]
	};
};

exports.Leafset = Leafset;