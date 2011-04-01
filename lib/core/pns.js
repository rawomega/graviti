//
// Implements the main algorithm from the PNS-CG paper. Given a
// known 'seed' node for bootstrapping, this algorithm will locate
// the closest node (in latency terms) to a node joining the ring.
//
var util = require('util');
var leafset = require('core/leafset');
var id = require('common/id');

var self = module.exports = {
	nearestNodeSearchTimeoutMsec : 20000,
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
		
		var req = self._inProgress[reqId];
		req.leafset_probes = {};
		Object.keys(msg.content.leafset).forEach(function(nodeId) {
			req.leafset_probes[nodeId] = new Date().getTime();
			var ap = msg.content.leafset[nodeId].split(':');
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
		// just respond
	},
	
	_handleRttProbeResponse : function(msg, msginfo) {
		// if leafset probe
			// if this is the first / fastest response
				// use this and throw others away
				// initialise deepest routing row
				// request routing table level
			// else throw this response away
		// else must be a row probe
			// do the same as for leafset but be mindful of level
			// and implement base case for when there is no improvement in nearest node, or we
			// have run out of nodes - then return result
	},
		
	findNearestNode : function(seedNodeAp, success, error) {		
		var reqId = id.generateUuid();
		var ap = seedNodeAp.split(':');
		self._inProgress[reqId] = {
				addr : ap[0],
				port : ap[1],
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