var logger = require('logmgr').getLogger('messaging/messagemgr');
var messages = require('messaging/messages');
var util = require('util');
var events = require('events');
var uri = require('common/uri');
var node = require('core/node');
var langutil = require('common/langutil');

MessageMgr = function(transportmgr) {
	events.EventEmitter.call(this);
	this.transportmgr = transportmgr;
	this.transportmgr.on("message", this._processMessage.bind(this));
};
util.inherits(MessageMgr, events.EventEmitter);

MessageMgr.prototype.router = undefined;

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
	if (destId === undefined)
		destId = uri.parse(destUri).hash;

	var msg = new messages.Message(destUri, content, headers, destId);
	this._processMessage(msg);
};

MessageMgr.prototype._processMessage = function(msg, msginfo) {
	if (this.router === undefined)
		throw new Error('Cannot process incoming or outgoing messages - no router has been set!');
	
	if (!msginfo) {
		msginfo = {
			app_name : uri.parse(msg.uri).app_name
		};
	}
	
	// figure out if this message is for us
	var isForThisNode = true;
	var nextHop = undefined;
	if (msg.dest_id !== undefined && msg.dest_id.length > 0) {			
		nextHop = this.router.getNextHop(msg.dest_id);
		if (nextHop.id !== node.nodeId) {
			logger.verbose((msg.source_id === node.nodeId ? 'Outbound' : 'En route') + ' forwarding message ' + msg.msg_id + ' to ' + msg.dest_id);
			isForThisNode = false;
		}
	}

	// if is for me, emit received, else emit forward
	if (isForThisNode) {
		logger.verbose('message for this node: uri ' + msg.uri + ', source ' + msg.source_id);
		if (msginfo.app_name === 'graviti') {
			this.emit('graviti-message-received', msg, msginfo);
		} else {				
			this.emit(msginfo.app_name + '-app-message-received', msg, msginfo);
		}
	} else {
		msginfo = langutil.extend(msginfo, {
			next_hop_id   : nextHop.id,
			next_hop_addr : nextHop.addr,
			next_hop_port : nextHop.port
		});
		if (msginfo.app_name === 'graviti') {
			this.emit('graviti-message-forwarding', msg, msginfo);
		} else {
			this.emit(msginfo.app_name + '-app-message-forwarding', msg, msginfo);
		}
		this.transportmgr.send(msginfo.next_hop_port, msginfo.next_hop_addr, msg);

		// optionally, ping the sender to suggest a better hop
		if (msg.source_id !== node.nodeId) {				
			this.router.suggestBetterHop(msg, msginfo);
		}
	}
};

exports.MessageMgr = MessageMgr;