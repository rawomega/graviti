if (global.GENTLY) require = GENTLY.hijack(require);
var node = require('./node');
var id = require('./id');
var util = require('util');
var uri = require('./uri');
var langutil = require('./langutil');
var routingutil = require('./routingutil');

//
// Manages overlay membership
var self = module.exports = langutil.extend(new events.EventEmitter(), {
	bootstrapping : false,
	bootstrappingIntervalId : undefined,
	defaultPort : 4728,
	bootstrapRetryIntervalMsec : 5000,
	leafset : {},
	routingtable : {},
	bootstrapEndpoints : {},

	//
	// Initialise ourselves as the first node in a ring
	init : function(port, bindAddr) {
		self._startNode(port, bindAddr);
	},
	
	//
	// Join an existing ring via specified bootstraps
	join : function(port, bindAddr, bootstraps) {
		if (!bootstraps || bootstraps.length < 1)
			throw new Error('Invalid or missing bootstrap list ' + bootstraps);		
		
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
				
		self._startNode(port, bindAddr);
		self._startBootstrapping();
	},
	
	_startNode : function(port, bindAddr) {
		node.on("message", self._processMessage);
		node.start(port, bindAddr);
	},
	
	_processMessage : function(msg, msginfo) {
		if (!msginfo)
			msginfo = {};
		
		// figure out if this message is for us
		var isForMe = routingutil.isForMe(msg.dest_id, node.nodeId, self.leafset);		
		
		// if is for me, emit received, else emit forward
		if (isForMe) {
			if (msginfo.app_name === 'graviti') {
				self._handleGravitiMessage(msg, msginfo);				
			} else {				
				self.emit('app-message', msg, msginfo);
			}
		} else {
			var nextHop = mapIdToNode();			
			msginfo = langutil.extend(msginfo, {
				next_hop_addr : nextHop.addr,
				next_hop_port : nextHop.port
			});
			self.emit('forwarding:' + msginfo.app_name, msg, msginfo);
			node.send(msginfo.next_hop_addr, msginfo.next_hop_port, msg);
		}
	},
	
	_handleGravitiMessage : function(msg, msginfo) {
		if (/\/bootstraptarget/.test(msg.uri)) {
			util.log('Bootstrap message from ' + msg.sender_id + ' (' + msginfo.sender_addr + ':' + msginfo.sender_port + ')');
			if (!msg.bootstrap_source_addr) {
				msg.bootstrap_source_addr = msginfo.sender_addr;				
				msg.bootstrap_source_port = msginfo.sender_port;
			}
			var content = {
					leafset : self.leafset,
					id : node.nodeId
			};
			
			
			self._updateLeafset(msg.source_id, msginfo.sender_addr + ':' + msginfo.sender_port); 
			
			// send our reply
			self.sendToAddr('p2p:graviti/bootstrapsource', content, undefined,
					msg.bootstrap_source_addr,	msg.bootstrap_source_port);
			
			// if we're not the nearest node, route message on to destination else tell bootstrapping node we're done

		} else if (/\/bootstrapsource/.test(msg.uri)) {
			util.log('Bootstrap response from ' + msg.content.id + ' (' + msginfo.sender_addr + ':' + msginfo.sender_port + ')');

			self._updateLeafset(msg.content.leafset);
			self._updateLeafset(msg.content.id, msginfo.sender_addr + ':' + msginfo.sender_port); 
		}
	},
	
	//
	// refresh leafset with a known node
	_updateLeafset : function(a,b) {
		if (!a)
			return;
		
		var nodes = a;
		if (typeof(a) === 'string') {
			nodes = {};
			nodes[a] = b;
		}
		
		// todo: right now we just put everything into leafset
		for (var id in nodes) {
			if (self.leafset[id]) {
				util.log('Updating node ' + id + ' in leafset');				
			} else {
				util.log('Adding node ' + id + ' to leafset');
			}
			self.leafset[id] = nodes[id];
		}
	},
	
	//
	// initiate a function (via setInterval) to check for any pending bootstrap messages and send them
	_startBootstrapping : function() {
		self.bootstrapping = true;
		self.bootstrappingIntervalId = setInterval (self._sendPendingBootstrapRequests, 1000);
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
				self.send('p2p:graviti/bootstraptarget', content, undefined, endpointParts[0], endpointParts[1]);
				endpointData.last_attempt_at = now;
			}
		}			
	},
	
	sendToAddr : function(destUri, content, headers, addr, port) {
		self.send(destUri, content, headers, addr, port, undefined);
	},
	
	sendToId : function(destUri, content, headers, destId) {
		self.send(destUri, content, headers, undefined, undefined, destId);
	},
	
	//
	// single message send to a uri
	send : function(destUri, content, headers, addr, port, destId) {
		if (!destId)
			destId = uri.parse(destUri).hash;
		
		var msg = langutil.extend({
			msg_id : id.generateUuid(),
			source_id : node.nodeId,
			dest_id : destId,
			created : new Date().getTime(),
			uri : destUri,
			method : 'GET',			
			content : content			
			// todo: correlation, transaction ids
		}, headers);
		
		if (addr)
			node.send(addr, port, msg);
		else
			self._processMessage(msg);
	},
	
	//
	// Leave the overlay, if we're part of it. Do this nicely, by letting
	// other nodes know, then tear down the node and exit.
	leave : function() {
		if (self.bootstrappingIntervalId)
			clearInterval(self.bootstrappingIntervalId);
		
		// todo: send parting message
		
		node.stop();
	}
});