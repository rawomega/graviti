//
// Implements the main algorithm from the PNS-CG paper. Given a
// known 'seed' node for bootstrapping, this algorithm will locate
// the closest node (in latency terms) to a node joining the ring.
//
var util = require('util');
var leafset = require('core/leafset');
var id = require('common/id');
var langutil = require('common/langutil');

var self = module.exports = {
	nearestNodeSearchTimeoutMsec : 20000,
	maxRoutingTableDepth : 10,
	overlayCallback : undefined,
	_inProgress : {},
	
	init : function(overlayCallback) {
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', function(msg, msginfo) {			
			if (msg.method === 'GET') {				
				if (/\/pns\/leafset/.test(msg.uri)) {
					self._handlePnsLeafsetRequest(msg, msginfo);
				} else if (/\/pns\/routingrow/.test(msg.uri)) {
					self._handlePnsRoutingRowRequest(msg, msginfo);
				} else if (/\/pns\/rttprobe/.test(msg.uri)) {
					self._handleRttProbeRequest(msg, msginfo);
				}
			} else if (msg.method === 'POST') {				
				if (/\/pns\/leafset/.test(msg.uri)) {
					self._handlePnsLeafsetResponse(msg, msginfo);
				} else if (/\/pns\/routingrow/.test(msg.uri)) {
					self._handlePnsRoutingRowResponse(msg, msginfo);
				} else if (/\/pns\/rttprobe/.test(msg.uri)) {
					self._handleRttProbeResponse(msg, msginfo);
				}
			}
		});	
	},
	
	_handlePnsLeafsetRequest : function(msg, msginfo) {
		util.log('PNS bootstrap request for leafset received');
		var reqId = msg.content.req_id;
		var ap = msginfo.source_ap.split(':');
		self.overlayCallback.sendToAddr('p2p:graviti/pns/leafset', {
				req_id : reqId,
				leafset : leafset.compressedLeafset()
			}, {method : 'POST'}, ap[0], ap[1]);
	},
	
	_handlePnsLeafsetResponse : function(msg, msginfo) {
		util.log('PNS bootstrap response with leafset received');
		var reqId = msg.content.req_id;
		if (msg.content.leafset === undefined || Object.keys(msg.content.leafset).length < 1) {
			self._reportSuccess(reqId, msg.source_id, msginfo.source_ap);
			return;
		}
		
		self._sendLeafsetProbes(reqId, msg.content.leafset);
	},
	
	_sendLeafsetProbes : function(reqId, leafset) {
		var req = self._inProgress[reqId];
		req.leafset_probes = {};
		Object.keys(leafset).forEach(function(nodeId) {
			req.leafset_probes[nodeId] = new Date().getTime();
			var ap = leafset[nodeId].split(':');
			self.overlayCallback.sendToAddr('p2p:graviti/pns/rttprobe', {
				req_id : reqId
			}, {method : 'GET'}, ap[0], ap[1]);
		});
	},

	_handlePnsRoutingRowRequest : function(msg, msginfo) {
		// if we have requested row
			// return it and its level
		// else return next highest row and its level
	},
	
	_handlePnsRoutingRowResponse : function(msg, msginfo) {
		// update current row
		// store probe state
		// probe all row elements
	},
	
	_handleRttProbeRequest : function(msg, msginfo) {
		util.log('PNS RTT probe received');
		var reqId = msg.content.req_id;
		var ap = msginfo.source_ap.split(':');
		self.overlayCallback.sendToAddr('p2p:graviti/pns/rttprobe', {
			req_id : reqId
		}, {method : 'POST'}, ap[0], ap[1]);
	},
	
	_handleRttProbeResponse : function(msg, msginfo) {
		// if leafset probe
		var reqId = msg.content.req_id;
		if (self._inProgress[reqId].leafset_probes === undefined)
			return;
		var probeSent = self._inProgress[reqId].leafset_probes[msg.source_id];
		if (!probeSent)
			return;
		
		delete self._inProgress[reqId].leafset_probes;
		var rtt = new Date().getTime() - probeSent;
		var nearest = self._inProgress[reqId].nearest;
		if (nearest.rtt !== undefined && nearest.rtt <= rtt) {
			self._reportSuccess(reqId, nearest.id, nearest.ap);
			return;
		}
		
		nearest.id = msg.source_id;
		nearest.ap = msginfo.source_ap;
		nearest.rtt = rtt;
		
		self._getRoutingRow(reqId, msginfo.source_ap, self.maxRoutingTableDepth);
		
		// else must be a row probe
			// do the same as for leafset but be mindful of level
			// and implement base case for when there is no improvement in nearest node, or we
			// have run out of nodes - then return result
	},
	
	_getRoutingRow : function(reqId, addrPort, depth) {
		var ap = addrPort.split(':');
		self.overlayCallback.sendToAddr('p2p:graviti/pns/routingrow', {
				req_id : reqId,
				depth : depth
			}, {method : 'GET'}, ap[0], ap[1]);
	},
	
//	_sendRoutingRowProbes : function(reqId, depth) {
//		var req = self._inProgress[reqId];
//		req.routing_probes = {};
//		Object.keys(leafset).forEach(function(nodeId) {
//			req.leafset_probes[nodeId] = new Date().getTime();
//			var ap = leafset[nodeId].split(':');
//			self.overlayCallback.sendToAddr('p2p:graviti/pns/rttprobe', {
//				req_id : reqId
//			}, {method : 'GET'}, ap[0], ap[1]);
//		});
//	},
		
	findNearestNode : function(seedNodeAp, success, error) {		
		var reqId = id.generateUuid();
		var ap = seedNodeAp.split(':');
		self._inProgress[reqId] = {
				addr : ap[0],
				port : ap[1],
				nearest : {},
				success : success,
				error : error
		};
		
		self.overlayCallback.sendToAddr('p2p:graviti/pns/leafset', {req_id : reqId},
				{method : 'GET'}, ap[0], ap[1]);
		
		setTimeout(function() {
			util.log('Bootstrap timed out whilst trying to locate nearest node via seed ' + seedNodeAp);
			delete self._inProgress[reqId];
			if (error)
				error();
		}, self.nearestNodeSearchTimeoutMsec);
		
		return reqId;
	},
	
	_reportSuccess : function(reqId, bestNodeId, bestNodeAp) {
		var req = self._inProgress[reqId];		
		if (!req)
			return;
		var success = req.success;
		delete self._inProgress[reqId];
		
		if (success)
			success(bestNodeId, bestNodeAp);
	},
	
	cancelAll : function() {

	}
};