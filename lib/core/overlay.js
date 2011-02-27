var util = require('util');
var node = require('core/node');
var id = require('common/id');
var uri = require('common/uri');
var langutil = require('common/langutil');
var bootstrapmgr = require('core/bootstrapmgr');
var heartbeater = require('core/heartbeater');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');

//
// Manages overlay membership
var self = module.exports = langutil.extend(new events.EventEmitter(), {
	//
	// Initialise ourselves as the first node in a ring
	init : function(port, bindAddr, nodeReadyCallback) {
		self._startNode(port, bindAddr, {
			success : function() {
				bootstrapmgr.start(self);
				heartbeater.start(self);
				
				if (nodeReadyCallback)
					nodeReadyCallback();
			}
		});
	},
	
	//
	// Join an existing ring via specified bootstraps
	join : function(port, bindAddr, bootstraps, joinedOverlayCallback) {
		self.on("bootstrap-completed", function() {
			if (joinedOverlayCallback)
				joinedOverlayCallback();
		});
		self._startNode(port, bindAddr, {
			success : function() {
				bootstrapmgr.start(self, bootstraps);
				heartbeater.start(self);
			}
		});
	},
		
	_startNode : function(port, bindAddr, opts) {
		heartbeater.on('peer-departed', function(id) {
			self.emit('peer-departed', id);
		});
		
		node.on("message", self._processMessage);
		node.start(port, bindAddr, opts);
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
		heartbeater.stop();
		
		node.stop();
	},
	
	//
	// Handle a received message, or an outbound message about to leave this node,
	// and decide what to do with it. If the message is for this node, we raise an event.
	// If it is for a remote node, we raise a forwarding event, letting app logic alter it
	_processMessage : function(msg, msginfo) {
		if (!msginfo) {
			msginfo = {
				app_name : uri.parse(msg.uri).app_name
			};
		}
		
		// figure out if this message is for us
		var isForThisNode = true;
		if (msg.dest_id !== undefined && msg.dest_id.length > 0) {
			var isThisNodeNearest = leafsetmgr.isThisNodeNearestTo(msg.dest_id);		
			var nextHop = routingmgr.getNextHop(msg.dest_id);			
			if (!isThisNodeNearest && nextHop.id !== node.nodeId) {
				util.log((msg.source_id === node.nodeId ? 'Outbound' : 'En route') + ' forwarding message ' + msg.msg_id + ' to ' + msg.dest_id);
				isForThisNode = false;
			}
		}

		// if is for me, emit received, else emit forward
		if (isForThisNode) {
			util.log('message for this node: uri ' + msg.uri + ', source ' + msg.source_id);
			if (msginfo.app_name === 'graviti') {
				self.emit('graviti-message-received', msg, msginfo);
			} else {
				self.emit(msginfo.app_name + '-app-message-received', msg, msginfo);
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
				self.emit(msginfo.app_name + '-app-message-forwarding', msg, msginfo);
			}
			node.send(msginfo.next_hop_addr, msginfo.next_hop_port, msg);
		}
	}
});