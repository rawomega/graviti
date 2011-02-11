var node = require('./node');
var id = require('../common/id');
var util = require('util');
var uri = require('../common/uri');
var langutil = require('../common/langutil');
var ringutil = require('./ringutil');
var bootstrapmgr = require('./bootstrapmgr');
var leafsetmgr = require('./leafsetmgr');
var routingmgr = require('./routingmgr');

//
// Manages overlay membership
var self = module.exports = langutil.extend(new events.EventEmitter(), {	
	//
	// Initialise ourselves as the first node in a ring
	init : function(port, bindAddr) {
		self._startNode(port, bindAddr, {
			success : function() {
				bootstrapmgr.start(self);	
			}
		});
	},
	
	//
	// Join an existing ring via specified bootstraps
	join : function(port, bindAddr, bootstraps) {
		self._startNode(port, bindAddr, {
			success : function() {
				bootstrapmgr.start(self, bootstraps);	
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
		bootstrapmgr.stop();
		
		// todo: send parting message
		
		node.stop();
	},
	
	_startNode : function(port, bindAddr, opts) {
		node.on("message", self._processMessage);
		node.start(port, bindAddr, opts);
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
				util.log('message ' + msg.msg_id + ' to ' + msg.dest_id + ' will be forwarded through this node (' + node.nodeId + ')');
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