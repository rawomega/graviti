var util = require('util');
var node = require('./node');
var langutil = require('common/langutil');
var ringutil = require('core/ringutil');
var bigint = require('thirdparty/bigint');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	leafsetSize : 20,
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
	
	
	//
	// add given peer directly to leafset, disregarding dead and candidate sets
	updateWithKnownGood : function(a, b) {
		self._update(a,b, function(id, addrPort) {
			if (self._deadset[id] !== undefined) {
				util.log('Found known good peer ' + id + ' in dead set, removing so it can be moved to leafset');
				delete self._deadset[id];
			}
			if (self._candidateset[id] !== undefined) {
				util.log('Found known good peer ' + id + ' in candidate set, removing so it can be moved to leafset');
				delete self._candidateset[id];
			}
			
			if (self._leafset[id]) {
				util.log('Updating node ' + id + ' in leafset');
				self._put(id, addrPort);
			} else if (Object.keys(self._leafset).length < self.leafsetSize) {
				util.log('Adding node ' + id + ' to leafset');
				self._put(id, addrPort);
			} else {	
				var furthestId = ringutil.getFurthestId(node.nodeId, Object.keys(self._leafset).concat([id]));
				if (furthestId === id)
					return;
				
				util.log('Evicting node ' + furthestId + ' from leafset and replacing with ' + id);
				delete self._leafset[furthestId];
				self._put(id, addrPort);
			}
		});
	},
	
	//
	// Add any new, unknown peers that are potentially leafset material to the candidate set
	updateWithProvisional : function(a,b) {
		self._update(a,b, function(id, addrPort) {
			if (self._deadset[id]) {
				util.log('Ignoring dead peer ' + id);
				return;
			}
			
			if (self._leafset[id])
				return;
			if (self._candidateset[id]) {
				if (self._candidateset[id].ap === addrPort)
					return;
				else
					util.log('Found provisional peer ' + id + ' with different ip (' + addrPort
							+ ') to that already seen (' + self._candidateset[id].ap + ')');
			}
			
			if (Object.keys(self._leafset).length >= self.leafsetSize) {
				var furthestId = ringutil.getFurthestId(node.nodeId, Object.keys(self._leafset).concat([id]));
				if (furthestId === id)
					return;
			}

			util.log('Adding node ' + id + ' to candidateset');
			self._candidateset[id] = {
				ap : addrPort,
				foundAt : new Date().getTime()
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
	
	_put : function(id, addrPort) {
		self._leafset[id] = {
			ap : addrPort,
			lastHeartbeatReceived : new Date().getTime()
		};
	},
	
	clearExpiredDeadAndCandidatePeers : function() {
		for (var id in self._deadset) {
			if (self._deadset[id].deadAt < (new Date().getTime() - self.departedPeerRetentionIntervalMsec))
				delete self._deadset[id];
		}
		for (var id in self._candidateset) {
			if (self._candidateset[id].foundAt < (new Date().getTime() - self.candidatePeerRetentionIntervalMsec))
				delete self._candidateset[id];
		}
	},
	
	removePeer : function(id) {
		util.log('Removing peer ' + id + ' from leafset');
		var removed = false;
		if (self._leafset[id] !== undefined) {
			removed = true;
			self._deadset[id] = self._leafset[id];
			self._deadset[id].deadAt = new Date().getTime();			
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
		
		var res = ringutil.getNearestId(id, leafsetIds, false);
		if (res.nearest) {
			var idBigint = bigint.str2bigInt(id, 16);
			// check if we're within leafset range
			if (res.highest && !bigint.greater(idBigint, res.highestBigint)
					&& res.lowest && !bigint.greater(res.lowestBigint, idBigint)) {
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
	
	isThisNodeNearestTo : function(id) {
		return ringutil.amINearest(id, node.nodeId, Object.keys(self._leafset));
	}
});