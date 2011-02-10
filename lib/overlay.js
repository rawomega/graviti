var node = require('./node');
var id = require('./id');
var util = require('util');
var uri = require('./uri');
var langutil = require('./langutil');
var ringutil = require('./ringutil');
var bootstrapper = require('./bootstrapper');
var leafsetmgr = require('./leafsetmgr');
var routingmgr = require('./routingmgr');

//
// Manages overlay membership
var self = module.exports = langutil.extend(new events.EventEmitter(), {	
	//
	// Initialise ourselves as the first node in a ring
	init : function(port, bindAddr) {
		self._startNode(port, bindAddr);
	},
	
	//
	// Join an existing ring via specified bootstraps
	join : function(port, bindAddr, bootstraps) {
		self._startNode(port, bindAddr, {
			success : function() {
				bootstrapper.start(self, bootstraps);			
			}
		});
	},
	
	//
	// Single message send to a uri. Uri's resource is hashed to form the destination id
	send : function(destUri, content, headers) {
		self._send(destUri, content, headers);
	},
	
	//
	// Send message directly to a specific known addr and port. Mainly for internal use 
	sendToAddr : function(destUri, content, headers, addr, port) {
		self._send(destUri, content, headers, addr, port, '');
	},
	
	//
	// Send message directly to a specific id (as opposed to the hashed resource in the uri)
	sendToId : function(destUri, content, headers, destId) {
		self._send(destUri, content, headers, undefined, undefined, destId);
	},
	
	//
	// Internal send
	_send : function(destUri, content, headers, addr, port, destId) {
		if (destId === undefined)
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
		bootstrapper.stop();
		
		// todo: send parting message
		
		node.stop();
	},
	
	_startNode : function(port, bindAddr, opts) {
		node.on("message", self._processMessage);
		node.start(port, bindAddr, opts);
		self.on('graviti-message-received', self._handleReceivedGravitiMessage);
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (msg.method === 'GET' && /\/statetables/.test(msg.uri)) {
			util.log('Bootstrap message from ' + msg.source_id + ' (' + msginfo.sender_addr + ':' + msginfo.sender_port + ')');
			if (!msg.bootstrap_source_addr) {
				msg.bootstrap_source_addr = msginfo.sender_addr;				
				msg.bootstrap_source_port = msginfo.sender_port;
			}
			var content = {
					leafset : leafsetmgr.leafset,
					routing_table : routingmgr.routingTable,
					id : node.nodeId
			};
				
			leafsetmgr.updateLeafset(msg.source_id, msginfo.sender_addr + ':' + msginfo.sender_port); 
			
			// send our reply
			self.sendToAddr('p2p:graviti/statetables', content, {method : 'POST'},
					msg.bootstrap_source_addr,	msg.bootstrap_source_port);
			
			// if we're not the nearest node, route message on to destination else tell bootstrapping node we're done

		}
	},
	
	//
	// Handle a received message, or an outbound message about to leave this node,
	// and decide what to do with it. If the message is for this node, we raise an event.
	// If it is for a remote node, we raise a forwarding event, letting app logic alter it
	_processMessage : function(msg, msginfo) {
		if (!msginfo)
			msginfo = {};
		
		// figure out if this message is for us
		var isForThisNode = true;
		if (msg.dest_id !== undefined && msg.dest_id.length > 0) {
			var iAmNearest = ringutil.amINearest(msg.dest_id, node.nodeId, leafsetmgr.leafset);		
			var nextHop = routingmgr.getNextHop(msg.dest_id);			
			if (!iAmNearest && nextHop.id !== node.nodeId) {
				isForThisNode = false;
			}
		}

		// if is for me, emit received, else emit forward
		if (isForThisNode) {
			util.log('message for me');
			if (msginfo.app_name === 'graviti') {
				self.emit('graviti-message-received', msg, msginfo);
			} else {
				self.emit('app-message-received', msg, msginfo);
			}
		} else {
			util.log('message to forward');
			msginfo = langutil.extend(msginfo, {
				next_hop_id   : nextHop.id,
				next_hop_addr : nextHop.addr,
				next_hop_port : nextHop.port
			});
			if (msginfo.app_name === 'graviti') {
				self.emit('graviti-message-forwarding', msg, msginfo);
			} else {
				self.emit('app-message-forwarding', msg, msginfo);				
			}
			node.send(msginfo.next_hop_addr, msginfo.next_hop_port, msg);
		}
	}
});