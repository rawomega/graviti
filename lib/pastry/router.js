var logger = require('logmgr').getLogger('pastry/router');
var mod_id = require('common/id');
var node = require('core/node');
var ringutil = require('common/ringutil');
var langutil = require('common/langutil');

Router = function(leafset, routingtable, heartbeater) {
	this.leafset = leafset;
	this.routingtable = routingtable;
	this.heartbeater = heartbeater;
};
exports.Router = Router;

//
// Get next routing hop from the leafset or from the routing table
Router.prototype.getNextHop = function(id) {
	var self = this;
	logger.verbose('beginning routing - leafset is ' + JSON.stringify(self.leafset.compressedLeafset()));
	if (node.nodeId === id)
		return {
			id   : node.nodeId
		};
	
	var leafsetHop = self.leafset.getRoutingHop(id);
	if (leafsetHop !== undefined) {
		logger.verbose('leafset routing hop for dest ' + id + ': ' + JSON.stringify(leafsetHop));
		return leafsetHop;
	}
	
	// route via routing table
	var commonPrefix = mod_id.getCommonPrefixLength(node.nodeId, id);			
	var rowForDigit = self.routingtable._table[commonPrefix];
	if (rowForDigit) {
		var routeForDigit = rowForDigit[id.charAt(commonPrefix)];
		if (routeForDigit) {
			logger.verbose('routing table hop for dest ' + id + ': ' + JSON.stringify(routeForDigit));
			return {
				id   : routeForDigit.id,
				addr : routeForDigit.ap.split(':')[0],
				port : routeForDigit.ap.split(':')[1]
			};
		}
	}
	
	// this means there is no routing table entry. This is the 'rare case' in the pastry paper
	var fallbackRoutingCandidates = {};
	fallbackRoutingCandidates[node.nodeId] = 'me';
	if (rowForDigit) {
		// add all nodes in the current routing table row as they may be better routing candidates than our node
		for (var i in rowForDigit) {
			fallbackRoutingCandidates[rowForDigit[i].id] = rowForDigit[i].ap;
		}
	}
	var rowForPreviousDigit = self.routingtable._table[commonPrefix-1];
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
	var l = self.leafset.compressedLeafset();
	var edgePeers = self.leafset.getEdgePeers();
	if (!fallbackRoutingCandidates[edgePeers.cw])
		fallbackRoutingCandidates[edgePeers.cw] = l[edgePeers.cw];
	if (!fallbackRoutingCandidates[edgePeers.ccw])
		fallbackRoutingCandidates[edgePeers.ccw] = l[edgePeers.ccw];
	
	var res = ringutil.getNearestId(id, fallbackRoutingCandidates);
	logger.verbose('fallback next hop routing to ' + id + ': '  + JSON.stringify(res)	+ ' obtained from fallback routing candidates ' + JSON.stringify(fallbackRoutingCandidates));
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
};

// let's see if we can offer the sender a better route to help it lazily repair its
// routing table (PNS paper, sect 3.2)
Router.prototype.suggestBetterHop = function(msg, msginfo) {
	var betterRoute = this.routingtable.findBetterRoutingHop(msg.source_id, msg.dest_id);
	if (betterRoute !== undefined) {
		logger.verbose('Found better route (' + betterRoute.id + ') for message from ' + msg.source_id + ' to ' + msg.dest_id + ', going to offer it back');
		var ap = msginfo.source_ap.split(':');
		var content = {
				routing_table : betterRoute.row
		};
		this.heartbeater.sendHeartbeatToAddr(ap[0], ap[1], content);
	}
};