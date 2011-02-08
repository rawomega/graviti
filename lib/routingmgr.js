var util = require('util'); 
var mod_id = require('./id');
var node = require('./node');

var self = module.exports = {
	// we store the routing table as an associative array to keep it sparse
	routingTable : {},
	
	//
	// Get next routing hop from the leafset or from the routing table
	getNextHop : function(id) {
		
	},
	
	//
	// update routing table with new nodes
	updateRoutingTable : function(id) {
		if (!id)
			return;

		for (var digit = 0; digit < mod_id.lengthBits / 4; digit++) {

			var currentNodeIdDigit = node.nodeId.charAt(digit);
			var currentIdDigit = id.charAt(digit);
			if (currentNodeIdDigit === currentIdDigit)
				continue;
			 
			var row = self.routingTable[digit];
			if (row && row[currentIdDigit])
				continue;
			 
			if (!row)
				 row = self.routingTable[digit] = {};
			row[currentIdDigit] = id;
			return;
		}
	}
};