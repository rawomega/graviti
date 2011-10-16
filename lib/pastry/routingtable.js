var logger = require('logmgr').getLogger('pastry/routingtable');
var ringutil = require('ringutil');
var langutil = require('langutil');

// we store the routing table as an associative array to keep it sparse
RoutingTable = function(nodeId) {
	this.nodeId = nodeId;
	this._table = {};
	this._candidatePeers = {};
	this._proposedBetterRoutingHops = {};
	this.candidatePeerRetentionIntervalMsec = 60 * 1000;
	this.proposedBetterRoutingHopsRetentionIntervalMsec = 10 * 60 * 1000;
	this.longRoundTripTimeMsec = 10 * 1000;	
};

// iterate over peers in the routing table
RoutingTable.prototype.each = function(callback) {
	var self = this;
	Object.keys(self._table).forEach(function(row) {
		Object.keys(self._table[row]).forEach(function(digit) {				
			callback(self._table[row][digit], row, digit);
		})
	});
};

//
// iterate over rows in the routing table
RoutingTable.prototype.eachRow = function(callback) {
	var self = this;
	Object.keys(self._table).forEach(function(rowIndex) {
		callback(parseInt(rowIndex), self._table[rowIndex]);
	});
};

//
// iterate over candidate peers
RoutingTable.prototype.eachCandidate = function(callback) {
	var self = this;
	Object.keys(self._candidatePeers).forEach(function(id) {
		callback(id, self._candidatePeers[id]);
	});
};

//
// get a particular peer from the routing table if it exists
RoutingTable.prototype.peer = function(id) {
	var commonPrefix = ringutil.getCommonPrefixLength(this.nodeId, id);
	var row = this._table[commonPrefix];
	if (!row)
		return undefined
	return row[id[commonPrefix]];
};

//
// updates our routing table with provisional peers from another
RoutingTable.prototype.mergeProvisional = function(rt) {
	this._merge(rt, true);
};
//
// updates routing table with known good peers 
RoutingTable.prototype.mergeKnownGood = function(rt) {
	this._merge(rt, false);
};

RoutingTable.prototype._merge = function(rt, provisional) {
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
				this.updateWithKnownGood(rt[digitPos][digitVal].id, rt[digitPos][digitVal].ap, rt[digitPos][digitVal].rtt);
		}
	}
	if (provisional)
		this.updateWithProvisional(nodes);
};

//
// update routing table with provisional peers given either as a node + addr or 
// a map of node -> addr pairs. By default, peers that are already 'known good'
// are ignored, but this can be overriden
RoutingTable.prototype.updateWithProvisional = function(a, b, overrideIfKnownGoodExists) {
	if (!a)
		return;
	
	var nodes = a;
	if (typeof(a) === 'string') {
		nodes = {};
		nodes[a] = b;
	}		
	for (var id in nodes) {
		if (id === this.nodeId)
			continue;

		if (overrideIfKnownGoodExists !== true && this.peer(id) !== undefined && this.peer(id).ap === nodes[id])
			continue;
		
		if (this._candidatePeers[id] !== undefined && this._candidatePeers[id].ap === nodes[id])
			continue;
		
		logger.verbose('Adding route ' + id + ' (' + nodes[id] + ') to routing candidate set: ' + JSON.stringify(this._candidatePeers));
		this._candidatePeers[id] = {
			ap : nodes[id],
			foundAt : Date.now()
		};
	}
};

//
// update routing table with ping results for a peer
RoutingTable.prototype.updateWithKnownGood = function(id, addrPort, roundTripTimeMillis) {		
	if (!id)
		return;
	if (id === this.nodeId)
		return;
	
	if (this._candidatePeers[id] !== undefined)
		delete this._candidatePeers[id]; 
	
	if (roundTripTimeMillis === undefined) {
		roundTripTimeMillis = this.longRoundTripTimeMsec;
		this.updateWithProvisional(id, addrPort, true);
	}
	
	for (var digit = 0; digit < ringutil.lengthBits / 4; digit++) {
		var currentNodeIdDigit = this.nodeId.charAt(digit);
		var currentIdDigit = id.charAt(digit);
		if (currentNodeIdDigit === currentIdDigit) {
			// still working our way down the common prefix, so compare the next bit
			continue;
		}
		 
		var row = this._table[digit];
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
			 row = this._table[digit] = {};

		row[currentIdDigit] = { id : id, ap : addrPort, rtt : roundTripTimeMillis};
		logger.verbose('Routing table entry [row ' + digit + ', dgt ' + currentIdDigit + '] set to ' + JSON.stringify(row[currentIdDigit]));
		break;
	}
};

//
// remove expired local state
RoutingTable.prototype.housekeep = function() {
	// get rid of expired provisional candidates
	for (var id in this._candidatePeers)
		if (this._candidatePeers[id].foundAt < Date.now() - this.candidatePeerRetentionIntervalMsec)
			delete this._candidatePeers[id];
	
	// get rid of proposed better routing hops that have now expired
	for (var sourceId in this._proposedBetterRoutingHops) {
		for (var destId in this._proposedBetterRoutingHops[sourceId])
			if (this._proposedBetterRoutingHops[sourceId][destId] < Date.now() - this.proposedBetterRoutingHopsRetentionIntervalMsec)
				delete this._proposedBetterRoutingHops[sourceId][destId];
		
		if (Object.keys(this._proposedBetterRoutingHops[sourceId]).length < 1)
			delete this._proposedBetterRoutingHops[sourceId];
	}
};

//
// get shared row from our routing table for a node with a given id
RoutingTable.prototype.getSharedRow = function(id) {
	var commonPrefixLength = ringutil.getCommonPrefixLength(this.nodeId, id);
	var res = {};
	res[commonPrefixLength] = langutil.extend({}, this._table[commonPrefixLength]);
	return res;
};

//
// given a source and destination id - typically originator and target for a message being routed -
// this function will attempt to find a better routing hop than this node in the node's routing table.
// this can then be used to push this better route to the originator and thereby implement lazy route
// maintenance (per Proximity Neighbor Selection paper)
//
// we also store proposed better routes for each source id in a local cache for a time, so that we don't
// keep on proposing better routes to a node that doesn't want them or has better knowledge of their liveness
//
RoutingTable.prototype.findBetterRoutingHop = function(sourceId, destId) {
	var self = this;
	var commonPrefixLengthWithSource = ringutil.getCommonPrefixLength(this.nodeId, sourceId);
	var commonPrefixLengthWithDest = ringutil.getCommonPrefixLength(this.nodeId, destId);
	for (var rowIndex = commonPrefixLengthWithSource; rowIndex >= commonPrefixLengthWithDest; rowIndex--) {
		var row = self._table[rowIndex];
		if (row === undefined)
			continue;
		
		var ids = [this.nodeId];
		Object.keys(row).forEach(function(digit) {
			var cachedProposalsForSource = self._proposedBetterRoutingHops[sourceId];
			if (cachedProposalsForSource !== undefined && cachedProposalsForSource[row[digit].id] !== undefined)
				return;
			ids.push(row[digit].id);
		});
		var res = ringutil.getNearestId(destId, ids, false);
		if (res.nearest !== this.nodeId) {
			self._proposedBetterRoutingHops[sourceId] = langutil.extend({}, self._proposedBetterRoutingHops[sourceId]);
			self._proposedBetterRoutingHops[sourceId][res.nearest] = Date.now();
			
			var ret = langutil.extend({}, row[res.nearest[rowIndex]]);
			ret.row = {};
			ret.row[rowIndex] = row;
			return ret;
		}
	}
	return undefined;
};

exports.RoutingTable = RoutingTable;