var logger = require('logmgr').getLogger('overlay/pastry/leafset');
var node = require('core/node');
var langutil = require('common/langutil');
var ringutil = require('overlay/pastry/ringutil');
var bigint = require('thirdparty/bigint');
var mod_id = require('common/id');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	leafsetSize : 20,
	timedOutPeerIntervalMsec : 35000,
	departedPeerRetentionIntervalMsec : 60*1000,
	candidatePeerRetentionIntervalMsec : 60*1000,
	_leafset : {},		// internal representation
	_deadset : {},		// for recently departed nodes, to stop having them re-added
	_candidateset : {},	// for recently discovered nodes, which get 'promoted' into leafset once confirmed alive	
	
	compressedLeafset : function() {
		var res = {};
		self.each(function(id, item) {
			res[id] = item.ap;
		});
		return res;
	},
	
	each : function(callback) {
		for (var id in self._leafset) {
			callback(id, self._leafset[id]);
		}
	},
	
	eachCandidate : function(callback) {
		for (var id in self._candidateset) {
			callback(id, self._candidateset[id]);
		}
	},
	
	peer : function(id) {
		return self._leafset[id];
	},
	
	//
	// add given peer directly to leafset, disregarding dead and candidate sets
	updateWithKnownGood : function(a, b) {
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
	},
	
	//
	// Add any new, unknown peers that are potentially leafset material to the candidate set
	updateWithProvisional : function(a,b) {
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
	},
	
	_update : function(a, b, nodeHandler) {
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
	},
	
	_put : function(id, addrPort, raiseEvent) {
		var existing = self._leafset[id] === undefined ? {} : self._leafset[id]; 
		self._leafset[id] = langutil.extend(existing, {
			ap : addrPort,
			lastHeartbeatReceived : Date.now()
		});
		
		if (raiseEvent === true)
			self.emit('peer-arrived', id);
	},
	
	clearExpiredDeadAndCandidatePeers : function() {
		for (var id in self._deadset) {
			if (self._deadset[id].deadAt < (Date.now() - self.departedPeerRetentionIntervalMsec))
				delete self._deadset[id];
		}
		for (var id in self._candidateset) {
			if (self._candidateset[id].foundAt < (Date.now() - self.candidatePeerRetentionIntervalMsec))
				delete self._candidateset[id];
		}
	},
	
	clearTimedOutPeers : function() {
		self.each(function(id, item) {
			if (item.lastHeartbeatReceived < (Date.now() - self.timedOutPeerIntervalMsec)) {
				logger.verbose('Found timed out peer ' + id + ' (' + item.ap + ')');
				self.removePeer(id);				
			}
		});
	},
	
	removePeer : function(id) {
		logger.verbose('Removing peer ' + id + ' from leafset');
		var removed = false;
		if (self._leafset[id] !== undefined) {
			removed = true;
			self._deadset[id] = self._leafset[id];
			self._deadset[id].deadAt = Date.now();			
		}
		delete self._leafset[id];
		
		if (removed)
			self.emit('peer-departed', id);
	},
	
	reset : function() {
		self._leafset = {};
		self._deadset = {};
		self._candidateset = {};
	},
	
	//
	// Gets node id nearest to the given id, without looking 'outside' the leafset range.
	// If this is not possible, returns undefined
	getRoutingHop : function(id) {
		var leafsetIds = Object.keys(self._leafset).concat([node.nodeId]);
		
		if (self.isWithinLeafsetRange(id)) {
			var res = ringutil.getNearestId(id, leafsetIds);
			if (res.nearest) {
				if (res.nearest === node.nodeId) {
					return {
						id : res.nearest
					};
				} else {
					return{
						id   : res.nearest,
						addr : self._leafset[res.nearest].ap.split(':')[0],
						port : self._leafset[res.nearest].ap.split(':')[1]
					};
				}
			}
		}
		return undefined;
	},
	
	isWithinLeafsetRange : function(id) {
		var currentLeafsetSize = Object.keys(self._leafset).length;
		if (currentLeafsetSize < 1)
			return false;
		
		// if id matches one of the leafset nodes exactly, we return it immediately; this is slightly
		// more efficient, but also saves having to handle duplicate ids when doing the sort just below
		if (Object.keys(self._leafset).indexOf(id) > -1)
			return true;

		var sorted = ringutil.sortByIncreasingDistance(node.nodeId, Object.keys(self._leafset).concat([id]));
		var idPos = sorted.indexOf(id);
		return idPos < self.leafsetSize / 2 || idPos > currentLeafsetSize - self.leafsetSize / 2; 
	},

	// TODO: replace use of this func elsewhere
	isThisNodeNearestTo : function(id) {
		return ringutil.amINearest(id, node.nodeId, Object.keys(self._leafset));
	},
	
	//
	// return 'edge' leafset peers in clockwise and anti-clockwise direction
	getEdgePeers : function() {
		if (Object.keys(self._leafset).length < 1) {
			return {
				cw : node.nodeId,
				ccw : node.nodeId
			};
		}
		
		var sorted = ringutil.sortByIncreasingDistance(node.nodeId, Object.keys(self._leafset));
		var cwIndex = Math.min(self.leafsetSize / 2 - 1, sorted.length-1);
		var ccwIndex = Math.max(sorted.length - self.leafsetSize / 2, 0);
		return {
			cw : sorted[cwIndex],
			ccw: sorted[ccwIndex]
		};
	}
});