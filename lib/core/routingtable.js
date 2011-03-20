var util = require('util'); 
var mod_id = require('common/id');
var node = require('core/node');
var langutil = require('common/langutil');

var self = module.exports = {
	// we store the routing table as an associative array to keep it sparse
	routingTable : {},
	
	// iterate over peers in the routing table
	each : function(callback) {
		Object.keys(self.routingTable).forEach(function(commonPrefix) {
			Object.keys(self.routingTable[commonPrefix]).forEach(function(digit) {				
				callback(self.routingTable[commonPrefix][digit], commonPrefix, digit);
			})
		});
	},
	
	// iterate over rows in the routing table
	eachRow : function(callback) {
		Object.keys(self.routingTable).forEach(function(row) {
			callback(row, self.routingTable[row]);
		});
	},
	
	//
	// updates our routing table with content from another
	mergeRoutingTable : function(rt) {
		if (rt === undefined)
			return;
		var nodes = {};
		for (var digitPos in rt) {
			if (rt[digitPos] === undefined)
				continue;
			for (var digitVal in rt[digitPos]) {
				nodes[rt[digitPos][digitVal].id] = rt[digitPos][digitVal].ap;
			}
		}
		self.updateRoutingTable(nodes);
	},
	
	//
	// update routing table with either a node + addr or a map of node -> addr pairs
	updateRoutingTable : function(a, b) {
		if (!a)
			return;
		
		var nodes = a;
		if (typeof(a) === 'string') {
			nodes = {};
			nodes[a] = b;
		}		
		for (var id in nodes) {
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
					break;
				}
	
				if (!row)
					 row = self.routingTable[digit] = {};
	
				util.log('Routing table entry [row ' + digit + ', dgt ' + currentIdDigit + ' set to ' + id + ' -> ' + nodes[id]);
				row[currentIdDigit] = {id:id, ap:nodes[id]};
				break;
			}
		}
	},
	
	//
	// get shared row from our routing table for a node with a given id
	getSharedRow : function(id) {
		var commonPrefixLength = mod_id.getCommonPrefixLength(node.nodeId, id);
		var res = {};
		res[commonPrefixLength] = langutil.extend({}, self.routingTable[commonPrefixLength]);
		return res;
	}
};