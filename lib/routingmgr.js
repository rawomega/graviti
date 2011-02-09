var util = require('util'); 
var mod_id = require('./id');
var node = require('./node');
var leafsetmgr = require('./leafsetmgr');
var ringutil = require('./ringutil');

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
				
		// this means there is no routing table entry. This is the 'rare case' in the pastry paper
		// todo: we should also request state tables from the target node to update ours
		var fallbackRoutingCandidateIds = [node.nodeId];
		if (rowForDigit) {
			// add all nodes in the current routing table row as they may be better routing candidates than our node
			for (var i in rowForDigit) {
				fallbackRoutingCandidateIds.push(rowForDigit[i]);
			}
		}
		var rowForPreviousDigit = self.routingTable[commonPrefix-1];
		if (rowForPreviousDigit) {
			// in the routing table row 'prior' to the one with (least common prefix + 1), there are only two entries
			// that could be better routing candidates than our current node. They are either side of our own node id.
			// For now we add all the entries from that row, though only those two are useful
			for (var j in rowForPreviousDigit) {
				fallbackRoutingCandidateIds.push(rowForPreviousDigit[j]);
			}
		}
		
		// also consider min and max leafset entries as we only looked 'inside' the leafset when looking
		// for a leafset route
		var leafsetMinMax = ringutil.getHighestAndLowestIds(leafsetmgr.leafset);
		if (leafsetMinMax && leafsetMinMax.highest)
			fallbackRoutingCandidateIds.push(leafsetMinMax.highest);
		if (leafsetMinMax && leafsetMinMax.lowest)
			fallbackRoutingCandidateIds.push(leafsetMinMax.lowest);

		var res = ringutil.getNearestId(id, fallbackRoutingCandidateIds).nearest;
		return (res && res !== node.nodeId) ? res : undefined;
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