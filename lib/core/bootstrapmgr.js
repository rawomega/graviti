//
// Manages the process of bootstrapping off of one or more known nodes, and handles
// any bootstrap requests from other nodes
// 
var util = require('util');
var langutil = require('common/langutil');
var node = require('core/node');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');
var ringutil = require('core/ringutil');

var self = module.exports = {
	overlayCallback : undefined,
	defaultPort : 4728,
	bootstrapping : false,
	bootstrapEndpoints : {},
	bootstrappingIntervalId : undefined,
	bootstrapRetryIntervalMsec : 5000,
	pendingRequestCheckIntervalMsec : 1000,

	//
	// initiate a function (via setInterval) to check for any pending bootstrap messages and send them
	start : function(overlayCallback, bootstraps) {
		if (bootstraps && bootstraps.length > 0) {
			self._startBootstrapping(bootstraps);
		} else {
			util.log('Empty bootstrap list given');
			util.log('=== Going to start a new ring as ' + node.nodeId + ' ===');
		}
		
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		self.overlayCallback.on('graviti-message-forwarding', self._handleForwardingGravitiMessage);
	},
	
	stop : function() {
		if (self.bootstrappingIntervalId)
			clearInterval(self.bootstrappingIntervalId);
	},
	
	_startBootstrapping : function(bootstraps) {
		util.log('Going to join overlay through bootstraps ' + bootstraps);
		var bootstrapParts = bootstraps.replace(/\s/g, '').split(',');
		for (var i = 0; i < bootstrapParts.length; i++) {			
			var endpointPort = self.defaultPort;
			var parts = bootstrapParts[i].split(':');
			var endpointAddr = parts[0];
			if (parts.length > 1)
				endpointPort = parts[1];
			
			self.bootstrapEndpoints[endpointAddr + ':' + endpointPort] = {
				last_attempt_at : 	0,
				last_response_at : 	0
			};
		}

		self.bootstrapping = true;
		self.bootstrappingIntervalId = setInterval (self._sendPendingBootstrapRequests, self.pendingRequestCheckIntervalMsec);
	},
	
	//
	// when invoked, looks for any 'stale' bootstrap requests that have not been acknowledged and resends them 
	_sendPendingBootstrapRequests : function() {
		if (!self.bootstrapping)
			return;

		for (var endpoint in self.bootstrapEndpoints) {						
			var endpointData = self.bootstrapEndpoints[endpoint];				
			var now = new Date().getTime();
			if (endpointData && endpointData.last_attempt_at < (now - self.bootstrapRetryIntervalMsec)) {
				util.log('Sending bootstrap req to ' + endpoint);
				var endpointParts = endpoint.split(':');
				var content = {
						id : node.nodeId
				};
				self.overlayCallback.sendToAddr('p2p:graviti/peers', content, {method : 'GET'}, endpointParts[0], endpointParts[1]);
				endpointData.last_attempt_at = now;
			}
		}
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (/\/peers/.test(msg.uri)) {
			if (msg.method === 'GET') {				
				self._handleBootstrapRequest(msg, msginfo, false);
			} else if (msg.method === 'POST') {				
				self._handleBootstrapResponse(msg, msginfo);
			}
		}
	},

	_handleForwardingGravitiMessage : function(msg, msginfo) {
		if (msg.method === 'GET' && (/\/peers/.test(msg.uri))) {
			self._handleBootstrapRequest(msg, msginfo, true);
		}
	},
	
	_handleBootstrapRequest : function(msg, msginfo, forwarding) {
		util.log('Bootstrap message for joining node ' + msg.content.id + ' from ' + msg.source_id + ' (' + msginfo.sender_addr + ':' + msginfo.sender_port + ')');		
		// set sender ip and port if we don't already have them
		var bootstrapSourceAddr = msg.content && msg.content.bootstrap_source_addr ? msg.content.bootstrap_source_addr : msginfo.sender_addr;		
		var bootstrapSourcePort = msg.content && msg.content.bootstrap_source_port ? msg.content.bootstrap_source_port : msginfo.sender_port;
		var leafset = leafsetmgr.compressedLeafset();
		var content = {
				leafset : leafset,
				routing_table : routingmgr.routingTable,
				id : node.nodeId,
				bootstrap_source_addr : bootstrapSourceAddr,
				bootstrap_source_port : bootstrapSourcePort
		};
			
		// if we're not the nearest node, route message on to destination else tell bootstrapping node we're done
		var joiningNodeId = msg.content.id;
		var iAmNearest = ringutil.amINearest(joiningNodeId, node.nodeId, leafset);
		if (iAmNearest) {
			// TODO: deal with case where joining node's node id is already in use
			content.last_bootstrap_hop = true;
		} else if (!forwarding) {
			util.log('Going to re-broadcast bootstrapping request into the ring on behalf of joining node ' + joiningNodeId);
			self.overlayCallback.send(
				'p2p:graviti/peers',
				langutil.extend(msg.content, {
					bootstrap_source_addr : bootstrapSourceAddr,
					bootstrap_source_port : bootstrapSourcePort
				}), {
					method : 'GET',
					dest_id : joiningNodeId
				}
			);
		}
			
		// send our reply
		self.overlayCallback.sendToAddr('p2p:graviti/peers', content, {method : 'POST'},
				bootstrapSourceAddr, bootstrapSourcePort);
		
		// and only now add new node to state tables, otherwise we may end up using it for routing!
		leafsetmgr.updateLeafset(msg.content.id, bootstrapSourceAddr + ':' + bootstrapSourcePort);
		routingmgr.updateRoutingTable(msg.content.id, bootstrapSourceAddr + ':' + bootstrapSourcePort);
	},
	
	_handleBootstrapResponse : function(msg, msginfo) {
		util.log('Bootstrap response from ' + msg.content.id + ' (' + msginfo.sender_addr + ':' + msginfo.sender_port + ')');
		
		// update out state tables with received leafset and routing table
		leafsetmgr.updateLeafset(msg.content.leafset);
		routingmgr.mergeRoutingTable(msg.content.routing_table);

		// also update state tables with responding node's own details
		leafsetmgr.updateLeafset(msg.content.id, msginfo.sender_addr + ':' + msginfo.sender_port);
		routingmgr.updateRoutingTable(msg.content.id, msginfo.sender_addr + ':' + msginfo.sender_port);
		
		// see if we're done bootstrapping
		if (msg.content.last_bootstrap_hop) {
			util.log('=== Bootstraping completed for node ' + node.nodeId + ' ===');
			self.bootstrapping = false;
			self.overlayCallback.emit('bootstrap-completed');
		}
	}
};