var util = require('util'); 
var mod_id = require('./id');
var node = require('./node');
var leafsetmgr = require('../lib/leafsetmgr');

var self = module.exports = {
	// we store the routing table as an associative array to keep it sparse
	routingTable : {},
	
	//
	// Get next routing hop from the leafset or from the routing table
	getNextHop : function(id) {
		var leafsetHop = leafsetmgr.getRoutingHop(id);
		if (leafsetHop)
			return leafsetHop;
		
		// route via routing table
		var startingDigit = mod_id.getFirstDifferentDigit(node.nodeId, id);
		if (startingDigit === -1) {
			// required id and node id are identical
			return undefined;
		}
			
		var bestRouteId = undefined
		for (var digit = 0; digit < mod_id.lengthBits / 4; digit++) {
			var rowForDigit = self.routingTable[digit];
			if (!rowForDigit)
				continue;
			var routeIdForDigit = rowForDigit[id.charAt(digit)];
			if (!routeIdForDigit)
				continue;
			var diff = mod_id.getFirstDifferentDigit(routeIdForDigit, id);
			if (diff >= digit)
				bestRouteId = routeIdForDigit;
		}
		return routeIdForDigit;
	},
	
	//
	// update routing table with new nodes
	updateRoutingTable : function(id) {
		if (!id)
			return;

		for (var digit = 0; digit < mod_id.lengthBits / 4; digit++) {
			var currentNodeIdDigit = node.nodeId.charAt(digit);
			var currentIdDigit = id.charAt(digit);
			if (currentNodeIdDigit === currentIdDigit) {
				// still working our way down the common prefix, so compare the next bit
				continue;
			}
			 
			var row = self.routingTable[digit];
			if (row && row[currentIdDigit]) {
				// an entry with this common prefix already exists
				return;
			}

			if (!row)
				 row = self.routingTable[digit] = {};
			row[currentIdDigit] = id;
			return;
		}
	}
};