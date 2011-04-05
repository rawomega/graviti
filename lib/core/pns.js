//
// Implements the main algorithm from the PNS-CG paper. Given a
// known 'seed' node for bootstrapping, this algorithm will locate
// the closest node (in latency terms) to a node joining the ring.
//
var util = require('util');
var leafset = require('core/leafset');
var routingtable = require('core/routingtable');
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

	//
	// Initiates search for a nearby node to 'bootstrap' off of. Result is delivered as a callback to
	// the success function. If no result is receivd within the given time window, the process ends
	// and the timeout notification is delivered via error.
	findNearestNode : function(seedNodeAp, success, error) {		
		var reqId = id.generateUuid();
		var ap = seedNodeAp.split(':');
		self._inProgress[reqId] = {
				addr : ap[0],
				port : ap[1],
				depth : self.maxRoutingTableDepth,
				routing_row_probes : {},
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
	
	//
	// Forget about all ongoing PNS nearby node searches by throwing away state. The error callback
	// function is not called.
	cancelAll : function() {
		util.log('Cancelling all existing PNS requests');
		self._inProgress = {};
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
		if (!self._inProgress[reqId])
			return;
		
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
		util.log('PNS routing row request received');
		var reqId = msg.content.req_id;
		var depth = msg.content.depth;
		var ap = msginfo.source_ap.split(':');
		var bestDepth = 0;
		var bestRow = {};
		
		if (depth !== undefined) {
			routingtable.eachRow(function(rowIndex, row) {
				if (rowIndex > depth || rowIndex < bestDepth)
					return;
				
				if (Object.keys(row).length > 0) {
					bestDepth = rowIndex;
					bestRow = row;
				}
			});			
		}
		self.overlayCallback.sendToAddr('p2p:graviti/pns/routingrow', {
				req_id : reqId,
				depth : bestDepth,
				routing_row : bestRow
			}, {method : 'POST'}, ap[0], ap[1]);
	},
	
	_handlePnsRoutingRowResponse : function(msg, msginfo) {
		util.log('PNS routing row response received');		
		var reqId = msg.content.req_id;
		var req = self._inProgress[reqId];
		if (req === undefined)
			return;

		req.depth = msg.content.depth === 0 ? 0 : msg.content.depth - 1;
		
		if (msg.content.routing_row === undefined || Object.keys(msg.content.routing_row).length < 1) {
			self._reportSuccess(reqId, req.nearest.id, req.nearest.ap);
			return;
		}
		
		self._sendRoutingRowProbes(reqId, msg.content.routing_row);
	},
	
	_handleRttProbeRequest : function(msg, msginfo) {
		util.log('PNS RTT probe request received');
		var reqId = msg.content.req_id;
		var ap = msginfo.source_ap.split(':');
		var content = {	req_id : reqId };
		if (msg.content.probe_id !== undefined)
			content.probe_id = msg.content.probe_id;
		self.overlayCallback.sendToAddr('p2p:graviti/pns/rttprobe', content, {method : 'POST'}, ap[0], ap[1]);
	},
	
	_handleRttProbeResponse : function(msg, msginfo) {
		util.log('PNS RTT probe response received');
		var reqId = msg.content.req_id;
		var req = self._inProgress[reqId];
		if (req === undefined)
			return;
		
		var probeSent;
		var probeId = msg.content.probe_id;
		if (probeId) {
			if (!req.routing_row_probes[probeId])
				return;
			probeSent = req.routing_row_probes[probeId][msg.source_id];
			if (!probeSent)
				return;
			delete req.routing_row_probes[probeId];
		} else {
			if (req.leafset_probes === undefined)
				return;			
			probeSent = req.leafset_probes[msg.source_id];
			if (!probeSent)
				return;
			delete req.leafset_probes;
		}
		
		var rtt = new Date().getTime() - probeSent;
		var nearest = req.nearest;
		if (nearest.rtt !== undefined && nearest.rtt <= rtt) {
			self._reportSuccess(reqId, nearest.id, nearest.ap);
			return;
		}
		
		nearest.id = msg.source_id;
		nearest.ap = msginfo.source_ap;
		nearest.rtt = rtt;
		
		self._sendRoutingRowRequest(reqId, msginfo.source_ap, req.depth);
	},
	
	_sendRoutingRowRequest : function(reqId, addrPort, depth) {
		var ap = addrPort.split(':');
		self.overlayCallback.sendToAddr('p2p:graviti/pns/routingrow', {
				req_id : reqId,
				depth : depth
			}, {method : 'GET'}, ap[0], ap[1]);
	},
	
	_sendRoutingRowProbes : function(reqId, row) {
		var req = self._inProgress[reqId];
		var probeId = id.generateUuid();
		req.routing_row_probes[probeId] = {};
		Object.keys(row).forEach(function(prefix) {
			var peer = row[prefix];
			req.routing_row_probes[probeId][peer.id] = new Date().getTime();
			var ap = peer.ap.split(':');
			self.overlayCallback.sendToAddr('p2p:graviti/pns/rttprobe', {
				req_id : reqId,
				probe_id : probeId
			}, {method : 'GET'}, ap[0], ap[1]);
		});
	},
	
	_reportSuccess : function(reqId, bestNodeId, bestNodeAp) {
		var req = self._inProgress[reqId];		
		if (!req)
			return;
		var success = req.success;
		delete self._inProgress[reqId];
		
		if (success)
			success(bestNodeId, bestNodeAp);
	}
};