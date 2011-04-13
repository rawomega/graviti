//
// Manages the process of bootstrapping off of one or more known nodes, and handles
// any bootstrap requests from other nodes.
// The implementation is based on
//  - "Pastry: Scalable, decentralized object location and routing for large-scale peer-to-peer systems"
//    (Antony Rowstron and Peter Druschel)
//  - "Proximity neighbor selection in tree-based structured peer-to-peer overlays"
//    (Miguel Castro, Peter Druschel, Y. Charlie Hu and Antony Rowstron)
// 
var util = require('util');
var langutil = require('common/langutil');
var node = require('core/node');
var leafset = require('core/leafset');
var routingtable = require('core/routingtable');
var ringutil = require('core/ringutil');
var heartbeater = require('core/heartbeater');
var pns = require('core/pns');

var self = module.exports = {
	usePns : true,
	maxPnsAttempts : 3,
	overlayCallback : undefined,
	defaultPort : 4728,
	bootstrapping : false,
	bootstrapEndpoints : {},
	bootstrappingIntervalId : undefined,
	bootstrapRetryIntervalMsec : 30000,
	pendingRequestCheckIntervalMsec : 1000,

	//
	// initiate a function (via setInterval) to check for any pending bootstrap messages and send them
	start : function(overlayCallback, bootstraps) {
		if (bootstraps && bootstraps.length > 0) {
			self._startBootstrapping(bootstraps);
		} else {
			util.log('=== Going to start a new ring as ' + node.nodeId + ' (empty bootstrap list) ===');
		}
		
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		self.overlayCallback.on('graviti-message-forwarding', self._handleForwardingGravitiMessage);
		
		pns.init(self.overlayCallback);
	},
	
	stop : function() {
		if (self.bootstrappingIntervalId)
			clearInterval(self.bootstrappingIntervalId);
		pns.cancelAll();
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
				last_response_at : 	0,
				pns_attempt : 0,				
				pns_discovered_peers : [],
				pns_used_seeds : []
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
			if (!endpointData || endpointData.last_attempt_at >= (new Date().getTime() - self.bootstrapRetryIntervalMsec))
				continue;
			
			endpointData.last_attempt_at = new Date().getTime();
			
			if (self.usePns) {
				self._pnsBootstrapFrom(endpoint, endpointData);
			} else {
				self.bootstrapFrom(endpoint);
			}
		}
	},
	
	_pnsBootstrapFrom : function(endpoint, endpointData) {
		endpointData.pns_attempt = endpointData.pns_attempt + 1;
		util.log('Starting PNS from seed ' + endpoint + ' with data ' + JSON.stringify(endpointData));		
		endpointData.pns_used_seeds.push(endpoint);		
		
		pns.findNearestNode(endpoint, node.nodeId, function(id, addrPort, discoveredPeers) {
			util.log('PNS from ' + node.nodeId + ' via seed ' + endpoint + ' gave nearest node '
					+ id + ' (' + addrPort + '), discovering peers ' + discoveredPeers);
			
			self._addDiscoveredPeers(endpointData, discoveredPeers);
			
			var numDiscoveredPeers = endpointData.pns_discovered_peers.length;
// TODO: take into account RTTs			
			if (numDiscoveredPeers < 1 || endpointData.pns_attempt >= self.maxPnsAttempts) {
				self._bootstrapFrom(addrPort);
			} else {
				// pick random peer from discovered nodes and repeat
				var newEndpoint = endpointData.pns_discovered_peers[Math.floor(Math.random()*numDiscoveredPeers)];
				langutil.arrRemoveItem(endpointData.pns_discovered_peers, newEndpoint);
				self._pnsBootstrapFrom(newEndpoint, endpointData);
			}
		});		
	},
	
	_addDiscoveredPeers : function(endpointData, discoveredPeers) {
		if (discoveredPeers === undefined)
			return;
		endpointData.pns_used_seeds.forEach(function(peer) {
			console.log('RRRRR ' + discoveredPeers + ' '+ peer);
			langutil.arrRemoveItem(discoveredPeers, peer);
		});
		discoveredPeers.forEach(function(peer) {
			if (endpointData.pns_discovered_peers.indexOf(peer) < 0)
				endpointData.pns_discovered_peers.push(peer);			
		});
	},

	_bootstrapFrom : function(targetNode) {
		util.log('Sending bootstrap req to ' + targetNode);
		var ap = targetNode.split(':');
		var content = {
				joining_node_id : node.nodeId
		};
		self.overlayCallback.sendToAddr('p2p:graviti/peers', content, {method : 'GET'}, ap[0], ap[1]);
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
		util.log('Bootstrap message for joining node ' + msg.content.joining_node_id + ' from ' + msg.source_id + ' (' + msginfo.source_ap + ')');		
		// set sender ip and port if we don't already have them
		var bootstrapSourceAp = msg.content && msg.content.bootstrap_source_ap ? msg.content.bootstrap_source_ap : msginfo.sender_ap;		
		var joiningNodeId = msg.content.joining_node_id;
		var sharedRoutingTableRow = routingtable.getSharedRow(joiningNodeId);
		var partialRoutingTable = langutil.extend(
				langutil.extend({}, msg.content.routing_table),
				sharedRoutingTableRow);
		
		// add ourselves to list of bootstrap req hops
		var bootstrapRequestHops = msg.content.bootstrap_request_hops === undefined ? [] : msg.content.bootstrap_request_hops;
		if (bootstrapRequestHops.indexOf(node.nodeId) < 0)
			bootstrapRequestHops.push(node.nodeId);
			
		// enrich message with our routing
		msg.content.routing_table = partialRoutingTable;
		msg.content.bootstrap_request_hops = bootstrapRequestHops;
		msg.content.bootstrap_source_ap = bootstrapSourceAp;

		// if we're merely forwarding, we're done
		if (forwarding)
			return;
		
		// if we're the nearest node, tell bootstrapping node we're done
		var isThisNodeNearest = leafset.isThisNodeNearestTo(joiningNodeId);
		if (isThisNodeNearest) {
			// TODO: deal with case where joining node's node id is already in use
			var content = {
					routing_table : partialRoutingTable,
					bootstrap_request_hops : bootstrapRequestHops,
					leafset : leafset.compressedLeafset(),
					last_bootstrap_hop : true
			};
			var ap = bootstrapSourceAp.split(':');
			self.overlayCallback.sendToAddr('p2p:graviti/peers', content, {method : 'POST'}, ap[0], ap[1]);
			
			return;
		} else {
			util.log('Going to re-broadcast bootstrapping request into the ring on behalf of joining node ' + joiningNodeId);
			self.overlayCallback.sendToId(
				'p2p:graviti/peers',
				msg.content,
				{method : 'GET'},
				joiningNodeId
			);
		}
	},
	
	//
	// a bootstrap response should be a final one in response to our bootstrap request,
	// or it may be from a newly joining node sending us its state tables once it has joined
	_handleBootstrapResponse : function(msg, msginfo) {
		util.log('Bootstrap response from ' + msg.source_id + ' (' + msginfo.source_ap + ')');
// TODO: ensure recipient gets to know its public ip from response (perhaps add a to header to resp)		
		if (msg.content.last_bootstrap_hop && self.bootstrapping) {
			util.log('=== Bootstraping completed for node ' + node.nodeId + ' ===');
			self.bootstrapping = false;
			leafset.updateWithKnownGood(msg.content.leafset);
			routingtable.mergeKnownGood(msg.content.routing_table);

			leafset.updateWithKnownGood(msg.source_id, msginfo.source_ap);
			routingtable.updateWithKnownGood(msg.source_id, msginfo.source_ap);

			self._sendStateTablesToPeers();
			self.overlayCallback.emit('bootstrap-completed');
		} else {
			util.log('WARN: unexpected bootstrap response from ' + msg.source_id);
		}
	},
	
	//
	// When done bootstrapping, we send a copy of our leafset to every peer that
	// appears in them, as well as routing rows applicable to routing table peers
	_sendStateTablesToPeers : function() {
		var destinations = {};
		// add leafset to be sent to each leafset peer
		leafset.each(function(id, peer) {
			destinations[peer.ap] = { leafset : leafset.compressedLeafset() };
		});
		
		// add routing table row to each peer in it 
		routingtable.eachRow(function(rowIndex, row) {
			var routingRow = {};
			routingRow[rowIndex] = row;
			Object.keys(row).forEach(function(digit) {
				var content = {	routing_table : routingRow };
				if (destinations[row[digit].ap] !== undefined) {
					destinations[row[digit].ap] = langutil.extend(destinations[row[digit].ap], content);
				} else {
					destinations[row[digit].ap] = content;
				}
			});
		});
		
		// do the sending
		util.log('Sending state tables to leafset and routing table peers ' + Object.keys(destinations) + ' upon bootstrap completion');
		Object.keys(destinations).forEach(function(addrPort) {
			var ap = addrPort.split(':');
			heartbeater.sendHeartbeatToAddr(ap[0], ap[1], destinations[addrPort]);
		});
	}
};