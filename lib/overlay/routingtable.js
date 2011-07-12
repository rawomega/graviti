var logger = require('logmgr').getLogger('overlay/routingtable');
var mod_id = require('common/id');
var node = require('core/node');
var ringutil = require('overlay/ringutil');
var langutil = require('common/langutil');

var self = module.exports = {
	// we store the routing table as an associative array to keep it sparse
	_table : {},
	_candidatePeers : {},
	_proposedBetterRoutingHops : {},
	candidatePeerRetentionIntervalMsec : 60 * 1000,
	proposedBetterRoutingHopsRetentionIntervalMsec : 10 * 60 * 1000,
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
		Object.keys(self._table).forEach(function(rowIndex) {
			callback(parseInt(rowIndex), self._table[rowIndex]);
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
	// a map of node -> addr pairs. By default, peers that are already 'known good'
	// are ignored, but this can be overriden
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

			if (overrideIfKnownGoodExists !== true && self.peer(id) !== undefined && self.peer(id).ap === nodes[id])
				continue;
			
			if (self._candidatePeers[id] !== undefined && self._candidatePeers[id].ap === nodes[id])
				continue;
			
			logger.verbose('Adding route ' + id + ' (' + nodes[id] + ') to routing candidate set: ' + JSON.stringify(self._candidatePeers));
			self._candidatePeers[id] = {
				ap : nodes[id],
				foundAt : Date.now()
			};
		}
	},
	
	//
	// update routing table with ping results for a peer
	updateWithKnownGood : function(id, addrPort, roundTripTimeMillis) {		
		if (!id)
			return;
		if (id === node.nodeId)
			return;
		
		if (self._candidatePeers[id] !== undefined)
			delete self._candidatePeers[id]; 
		
		if (roundTripTimeMillis === undefined) {
			roundTripTimeMillis = self.longRoundTripTimeMsec;
			self.updateWithProvisional(id, addrPort, true);
		}
		
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
					logger.verbose('Updating existing routing table entry for row ' + digit + ', dgt ' + currentIdDigit
							+ ' with id ' + id + ', addr ' + addrPort + ', rtt ' + roundTripTimeMillis );
					row[currentIdDigit].ap = addrPort;
					row[currentIdDigit].rtt = roundTripTimeMillis;
					break;
				} else if (roundTripTimeMillis > row[currentIdDigit].rtt) {
					logger.verbose('Existing routing table entry for row ' + digit + ', dgt ' + currentIdDigit + ' has rtt '
						+ roundTripTimeMillis + 'ms and is nearer than ' + id + ' at ' + roundTripTimeMillis + 'ms');
					break;
				}
			}

			if (!row)
				 row = self._table[digit] = {};

			row[currentIdDigit] = { id : id, ap : addrPort, rtt : roundTripTimeMillis};
			logger.verbose('Routing table entry [row ' + digit + ', dgt ' + currentIdDigit + '] set to ' + JSON.stringify(row[currentIdDigit]));
			break;
		}
	},
	
	//
	// remove expired local state
	housekeep : function() {
		// get rid of expired provisional candidates
		for (var id in self._candidatePeers)
			if (self._candidatePeers[id].foundAt < Date.now() - self.candidatePeerRetentionIntervalMsec)
				delete self._candidatePeers[id];
		
		// get rid of proposed better routing hops that have now expired
		for (var sourceId in self._proposedBetterRoutingHops) {
			for (var destId in self._proposedBetterRoutingHops[sourceId])
				if (self._proposedBetterRoutingHops[sourceId][destId] < Date.now() - self.proposedBetterRoutingHopsRetentionIntervalMsec)
					delete self._proposedBetterRoutingHops[sourceId][destId];
			
			if (Object.keys(self._proposedBetterRoutingHops[sourceId]).length < 1)
				delete self._proposedBetterRoutingHops[sourceId];
		}
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
	//
	// we also store proposed better routes for each source id in a local cache for a time, so that we don't
	// keep on proposing better routes to a node that doesn't want them or has better knowledge of their liveness
	//
	findBetterRoutingHop : function(sourceId, destId) {
		var commonPrefixLengthWithSource = mod_id.getCommonPrefixLength(node.nodeId, sourceId);
		var commonPrefixLengthWithDest = mod_id.getCommonPrefixLength(node.nodeId, destId);
		for (var rowIndex = commonPrefixLengthWithSource; rowIndex >= commonPrefixLengthWithDest; rowIndex--) {
			var row = self._table[rowIndex];
			if (row === undefined)
				continue;
			
			var ids = [node.nodeId];
			Object.keys(row).forEach(function(digit) {
				var cachedProposalsForSource = self._proposedBetterRoutingHops[sourceId];
				if (cachedProposalsForSource !== undefined && cachedProposalsForSource[row[digit].id] !== undefined)
					return;
				ids.push(row[digit].id);
			});
			var res = ringutil.getNearestId(destId, ids, false);
			if (res.nearest !== node.nodeId) {
				self._proposedBetterRoutingHops[sourceId] = langutil.extend({}, self._proposedBetterRoutingHops[sourceId]);
				self._proposedBetterRoutingHops[sourceId][res.nearest] = Date.now();
				
				var ret = langutil.extend({}, row[res.nearest[rowIndex]]);
				ret.row = {};
				ret.row[rowIndex] = row;
				return ret;
			}
		}
		return undefined;
	}
};