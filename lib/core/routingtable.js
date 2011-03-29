var util = require('util'); 
var mod_id = require('common/id');
var node = require('core/node');
var ringutil = require('core/ringutil');
var langutil = require('common/langutil');

var self = module.exports = {
	// we store the routing table as an associative array to keep it sparse
	_table : {},
	_candidatePeers : {},
	candidatePeerRetentionIntervalMsec : 60*1000,
	longRoundTripTimeMsec : 10 * 1000,
	
	// iterate over peers in the routing table
	each : function(callback) {
		Object.keys(self._table).forEach(function(row) {
			Object.keys(self._table[row]).forEach(function(digit) {				
				callback(self._table[row][digit], row, digit);
			})
		});
	},
	
	//
	// iterate over rows in the routing table
	eachRow : function(callback) {
		Object.keys(self._table).forEach(function(row) {
			callback(row, self._table[row]);
		});
	},
	
	//
	// iterate over candidate peers
	eachCandidate : function(callback) {
		Object.keys(self._candidatePeers).forEach(function(id) {
			callback(id, self._candidatePeers[id]);
		});
	},
	
	//
	// get a particular peer from the routing table if it exists
	peer : function(id) {
		var commonPrefix = mod_id.getCommonPrefixLength(node.nodeId, id);
		var row = self._table[commonPrefix];
		if (!row)
			return undefined
		return row[id[commonPrefix]];
	},
	
	//
	// updates our routing table with provisional peers from another
	mergeProvisional : function(rt) {
		self._merge(rt, true);
	},
	//
	// updates routing table with known good peers 
	mergeKnownGood : function(rt) {
		self._merge(rt, false);
	},
	
	_merge : function(rt, provisional) {
		if (rt === undefined)
			return;
		var nodes = {};
		for (var digitPos in rt) {
			if (rt[digitPos] === undefined)
				continue;
			for (var digitVal in rt[digitPos]) {
				if (provisional)
					nodes[rt[digitPos][digitVal].id] = rt[digitPos][digitVal].ap;
				else
					self.updateWithKnownGood(rt[digitPos][digitVal].id, rt[digitPos][digitVal].ap, rt[digitPos][digitVal].rtt);
			}
		}
		if (provisional)
			self.updateWithProvisional(nodes);
	},
	
	//
	// update routing table with provisional peers given either as a node + addr or 
	// a map of node -> addr pairs
	updateWithProvisional : function(a, b, overrideIfKnownGoodExists) {
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
			
			// TODO: test
			if (overrideIfKnownGoodExists !== true && self.peer(id) !== undefined && self.peer(id).ap === nodes[id])
				continue;
			
			if (self._candidatePeers[id] !== undefined && self._candidatePeers[id].ap === nodes[id])
				continue;
			
			util.log('Adding route ' + id + ' (' + nodes[id] + ') to routing candidate set: ' + JSON.stringify(self._candidatePeers));
			self._candidatePeers[id] = {
				ap : nodes[id],
				foundAt : new Date().getTime()
			};
		}
	},
	
	//
	// update routing table with ping results for a peer
	updateWithKnownGood : function(id, addrPort, roundTripTimeMillis) {
		if (!id)
			return;
		if (roundTripTimeMillis === undefined)
			roundTripTimeMillis = self.longRoundTripTimeMsec;
		
		if (self._candidatePeers[id] !== undefined)
			delete self._candidatePeers[id]; 
		
		for (var digit = 0; digit < mod_id.lengthBits / 4; digit++) {
			var currentNodeIdDigit = node.nodeId.charAt(digit);
			var currentIdDigit = id.charAt(digit);
			if (currentNodeIdDigit === currentIdDigit) {
				// still working our way down the common prefix, so compare the next bit
				continue;
			}
			 
			var row = self._table[digit];
			if (row && row[currentIdDigit]) {
				if (row[currentIdDigit].id === id) {
					util.log('Updating existing routing table entry for row ' + digit + ', dgt ' + currentIdDigit
							+ ' with id ' + id + ', addr ' + addrPort + ', rtt ' + roundTripTimeMillis );
					row[currentIdDigit].ap = addrPort;
					row[currentIdDigit].rtt = roundTripTimeMillis;
					break;
				} else if (roundTripTimeMillis > row[currentIdDigit].rtt) {
					util.log('Existing routing table entry for row ' + digit + ', dgt ' + currentIdDigit + ' has rtt '
						+ roundTripTimeMillis + 'ms and is nearer than ' + id + ' at ' + roundTripTimeMillis + 'ms');
					break;
				}
			}

			if (!row)
				 row = self._table[digit] = {};

			row[currentIdDigit] = { id : id, ap : addrPort, rtt : roundTripTimeMillis};
			util.log('Routing table entry [row ' + digit + ', dgt ' + currentIdDigit + '] set to ' + JSON.stringify(row[currentIdDigit]));
			break;
		}
	},
	
	clearExpiredCandidatePeers : function() {
		for (var id in self._candidatePeers)
			if (self._candidatePeers[id].foundAt < new Date().getTime() - self.candidatePeerRetentionIntervalMsec)
				delete self._candidatePeers[id];
	},
	
	//
	// get shared row from our routing table for a node with a given id
	getSharedRow : function(id) {
		var commonPrefixLength = mod_id.getCommonPrefixLength(node.nodeId, id);
		var res = {};
		res[commonPrefixLength] = langutil.extend({}, self._table[commonPrefixLength]);
		return res;
	},
	
	//
	// given a source and destination id - typically originator and target for a message being routed -
	// this function will attempt to find a better routing hop than this node in the node's routing table.
	// this can then be used to push this better route to the originator and thereby implement lazy route
	// maintenance (per Proximity Neighbor Selection paper)
	findBetterRoutingHop : function(sourceId, destId) {
		var commonPrefixLengthWithSource = mod_id.getCommonPrefixLength(node.nodeId, sourceId);
		var commonPrefixLengthWithDest = mod_id.getCommonPrefixLength(node.nodeId, destId);
		for (var rowIndex = commonPrefixLengthWithSource; rowIndex >= commonPrefixLengthWithDest; rowIndex--) {
			var row = self._table[rowIndex];
			if (row === undefined)
				continue;
			
			var ids = [node.nodeId];
			Object.keys(row).forEach(function(digit) {
				ids.push(row[digit].id);
			});
			var res = ringutil.getNearestId(destId, ids, false);
			if (res.nearest !== node.nodeId) {
				var ret = langutil.extend({}, row[res.nearest[rowIndex]]);
				ret.row = {};
				ret.row[rowIndex] = row;
				return ret;
			}
		}
		return undefined;
	}
};