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
		if (node.nodeId === id)
			return undefined;
		
		var leafsetHop = leafsetmgr.getRoutingHop(id);
		if (leafsetHop)
			return leafsetHop;
		
		// route via routing table
		var commonPrefix = mod_id.getCommonPrefixLength(node.nodeId, id);			
		var rowForDigit = self.routingTable[commonPrefix];
		if (rowForDigit) {
			var routeIdForDigit = rowForDigit[id.charAt(commonPrefix)];
			if (routeIdForDigit)
				return routeIdForDigit;			
		}
				
		// this means there is no routing table entry
		return undefined;
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