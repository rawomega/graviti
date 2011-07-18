var logger = require('logmgr').getLogger('messaging/messagemgr');
var messages = require('messaging/messages');

MessageMgr = function(transportmgr) {
	this.transportmgr = transportmgr;
};

//
// Overlay - specific handler that implements the following contract for messages:
// - implements function(msg), where msg is a Message instance
// - accepts messages that are destined for this node and raises appropriate events
// - sends on messages that are destined for another node and raises any appropriate events (e.g. forwarding)
MessageMgr.prototype.handleMessage = undefined;

//
// Single message send to a uri. Uri's resource is hashed to form the destination id
MessageMgr.prototype.send = function(destUri, content, headers) {
	this._send(destUri, content, headers);
};

//
// Send message directly to a specific known addr and port. Mainly for internal use 
MessageMgr.prototype.sendToAddr = function(destUri, content, headers, addr, port) {
	var msg = new messages.Message(destUri, content, headers);
	this.transportmgr.send(port, addr, msg);
},

//
// Send message directly to a specific id (as opposed to the hashed resource in the uri)
MessageMgr.prototype.sendToId = function(destUri, content, headers, destId) {
	this._send(destUri, content, headers, undefined, undefined, destId);
};

//
// Internal send
MessageMgr.prototype._send = function(destUri, content, headers, addr, port, destId) {
	if (this.handleMessage === undefined)
		throw new Error('Cannot send message - no message handler has been set!');

	if (destId === undefined)
		destId = uri.parse(destUri).hash;

	var msg = new messages.Message(destUri, content, headers, destId);
	this._processMessage(msg);
};

MessageMgr.prototype._processMessage : function(msg, msginfo, emitter) {
	// figure out if this message is for us
	var isForThisNode = true;
	var nextHop = undefined;
	if (msg.dest_id !== undefined && msg.dest_id.length > 0) {			
		nextHop = routingmgr.getNextHop(msg.dest_id);
		if (nextHop.id !== node.nodeId) {
			logger.verbose((msg.source_id === node.nodeId ? 'Outbound' : 'En route') + ' forwarding message ' + msg.msg_id + ' to ' + msg.dest_id);
			isForThisNode = false;
		}
	}

	// if is for me, emit received, else emit forward
	if (isForThisNode) {
		logger.verbose('message for this node: uri ' + msg.uri + ', source ' + msg.source_id);
		if (msginfo.app_name === 'graviti') {
			emitter.emit('graviti-message-received', msg, msginfo);
		} else {				
			emitter.emit(msginfo.app_name + '-app-message-received', msg, msginfo);
		}
	} else {
		msginfo = langutil.extend(msginfo, {
			next_hop_id   : nextHop.id,
			next_hop_addr : nextHop.addr,
			next_hop_port : nextHop.port
		});
		if (msginfo.app_name === 'graviti') {
			emitter.emit('graviti-message-forwarding', msg, msginfo);
		} else {
			emitter.emit(msginfo.app_name + '-app-message-forwarding', msg, msginfo);
		}
		transportmgr.send(msginfo.next_hop_port, msginfo.next_hop_addr, msg);
		
		// let's see if we can offer the sender a better route to help it lazily repair its
		// routing table (PNS paper, sect 3.2)
		if (msg.source_id !== node.nodeId) {				
			var betterRoute = routingtable.findBetterRoutingHop(msg.source_id, msg.dest_id);
			if (betterRoute !== undefined) {
				logger.verbose('Found better route (' + betterRoute.id + ') for message from ' + msg.source_id + ' to ' + msg.dest_id + ', going to offer it back');
				var ap = msginfo.source_ap.split(':');
				var content = {
						routing_table : betterRoute.row
				};		
				heartbeater.sendHeartbeatToAddr(ap[0], ap[1], content);
			}
		}
	}
};

exports.MessageMgr = MessageMgr;