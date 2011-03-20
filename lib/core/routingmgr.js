var util = require('util'); 
var mod_id = require('common/id');
var node = require('core/node');
var leafset = require('core/leafset');
var ringutil = require('core/ringutil');
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
	// Get next routing hop from the leafset or from the routing table
	getNextHop : function(id) {
		if (node.nodeId === id)
			return {
				id   : node.nodeId
			};
		
		var leafsetHop = leafset.getRoutingHop(id);
		if (leafsetHop !== undefined) {
			return leafsetHop;
		}
		
		// route via routing table
		var commonPrefix = mod_id.getCommonPrefixLength(node.nodeId, id);			
		var rowForDigit = self.routingTable[commonPrefix];
		if (rowForDigit) {
			var routeForDigit = rowForDigit[id.charAt(commonPrefix)];
			if (routeForDigit) {
				return {
					id   : routeForDigit.id,
					addr : routeForDigit.ap.split(':')[0],
					port : routeForDigit.ap.split(':')[1]
				};
			}
		}

		// this means there is no routing table entry. This is the 'rare case' in the pastry paper
		// todo: we should also request state tables from the target node to update ours		
		var fallbackRoutingCandidates = {};
		fallbackRoutingCandidates[node.nodeId] = 'me';
		if (rowForDigit) {
			// add all nodes in the current routing table row as they may be better routing candidates than our node
			for (var i in rowForDigit) {
				fallbackRoutingCandidates[rowForDigit[i].id] = rowForDigit[i].ap;
			}
		}
		var rowForPreviousDigit = self.routingTable[commonPrefix-1];
		if (rowForPreviousDigit) {
			// in the routing table row 'prior' to the one with (least common prefix + 1), there are only two entries
			// that could be better routing candidates than our current node. They are either side of our own node id.
			// For now we add all the entries from that row, though only those two are useful
			for (var j in rowForPreviousDigit) {
				fallbackRoutingCandidates[rowForPreviousDigit[j].id] = rowForPreviousDigit[j].ap;
			}
		}
		
		// also consider min and max leafset entries as we only looked 'inside' the leafset when looking
		// for a leafset route
		var l = leafset.compressedLeafset();
		var leafsetMinMax = ringutil.getHighestAndLowestIds(l);
		if (leafsetMinMax && leafsetMinMax.highest)
			fallbackRoutingCandidates[leafsetMinMax.highest] = l[leafsetMinMax.highest];
		if (leafsetMinMax && leafsetMinMax.lowest)
			fallbackRoutingCandidates[leafsetMinMax.lowest] = l[leafsetMinMax.lowest];

		var res = ringutil.getNearestId(id, fallbackRoutingCandidates);
		if (res.nearest === node.nodeId) {
			return {
				id   : res.nearest
			};	
		} else {
			return {
				id   : res.nearest,
				addr : fallbackRoutingCandidates[res.nearest].split(':')[0],
				port : fallbackRoutingCandidates[res.nearest].split(':')[1]
			};
		}
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