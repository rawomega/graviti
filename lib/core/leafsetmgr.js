var util = require('util');
var node = require('./node');
var langutil = require('common/langutil');
var ringutil = require('core/ringutil');
var bigint = require('thirdparty/bigint');

var self = module.exports = {
	leafsetSize : 20,
	leafset : {},
	
	compressedLeafset : function() {
		var res = {};
		for (var id in self.leafset) {
			res[id] = self.leafset[id].ap;
		}
		return res;
	},
	
	//
	// refresh leafset with either a known node or a map of node -> addr
	updateLeafset : function(a,b) {
		if (!a)
			return;
		
		var nodes = a;
		if (typeof(a) === 'string') {
			nodes = {};
			nodes[a] = b;
		}
		
		for (var id in nodes) {
			if (id === node.nodeId)
				continue;
			if (self.leafset[id]) {
				util.log('Updating node ' + id + ' in leafset');
				self.leafset[id] = {
					ap : nodes[id],
					lastHeartbeatReceived : new Date().getTime()
				};
				continue;
			}
			
			if (Object.keys(self.leafset).length < self.leafsetSize) {
				util.log('Adding node ' + id + ' to leafset');
				self.leafset[id] = {
					ap : nodes[id],
					lastHeartbeatReceived : new Date().getTime()
				};
			} else {
				var furthestId = ringutil.getFurthestId(id, Object.keys(self.leafset));
				util.log('Evicting node ' + furthestId + ' from leafset and replacing with ' + id);
				delete self.leafset[furthestId];
				self.leafset[id] = {
					ap : nodes[id],
					lastHeartbeatReceived : new Date().getTime()
				};
			}
		}
	},
	
	//
	// Gets node id nearest to the given id, without looking 'outside' the leafset range.
	// If this is not possible, returns undefined
	getRoutingHop : function(id) {
		var leafsetIds = Object.keys(self.leafset).concat([node.nodeId]);
		
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
						addr : self.leafset[res.nearest].ap.split(':')[0],
						port : self.leafset[res.nearest].ap.split(':')[1]
					};
				}
			}
		}
		return undefined;
	}
};