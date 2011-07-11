//
// This module anages low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and low (udp) level message sends / receives.
// Emits lifecycle events.
//
var logger = require('logmgr').getLogger('core/node');
var langutil = require('common/langutil');
var id = require('common/id');
var uri = require('common/uri');
var messagemgr = require('messaging/messagemgr');
var messageparser = require('messaging/messageparser');
var messages = require('messaging/messages');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	// current node id
	nodeId : undefined,	

	//
	// Initializes this node. Essentially this means we bind to local addr + port.
	// We also set up parsing and emitting of received messages
	start : function(port, bindAddr, opts) {		
		if (self.nodeId === undefined)
			self.nodeId = self._initId();

		messagemgr.start(port, bindAddr, self.receiveData, function() {
			if (opts && opts.success)
				opts.success();
		});
	},

	//
	// Orderly shutdown of this p2p node.
	stop : function() {
		logger.info('Stopping node ' + self.nodeId);
		messagemgr.stop();
	},
	
	receiveData : function(data, remoteAddress, inProgressState) {		
		var ack = messageparser.parseAck(data);
		if (ack !== undefined) {
			logger.verbose('Received ACK for ' + ack.msg_id);
			self.emit('message-ack', ack.msg_id);
			return;
		}
		
		var parsed = messageparser.progressiveParse(data, inProgressState);
		if (!parsed.content_processed) {
			return parsed;
		}

		parsed.headers['method'] = parsed.method;
		var msg = new messages.Message(parsed.uri, parsed.content, parsed.headers); 		
		logger.verbose('Message from ' + remoteAddress + ':' + msg.sender_port + ' :\n' + data);
		
		if (msg.source_port === undefined)
			throw new Error('Source port not found in received message');
		if (msg.source_addr === undefined)
			msg.source_addr = remoteAddress;

		messagemgr.send(msg.source_port, msg.source_addr, new messages.Ack(msg.msg_id));
		
		if (msg.hops > 99)
			throw new Error('Too many hops (probable looping), discarding message ' + msg.msg_id);
		if (msg.sender_port === undefined)
			throw new Error('Sender port not found in received message');
		
		var msginfo = {
				source_ap : msg.source_addr + ':' + msg.source_port,
				sender_ap : remoteAddress + ':' + msg.sender_port		
		};
		
		var parsedUri = uri.parse(msg.uri);
		msginfo.app_name = parsedUri.app_name;
		self.emit('message', msg, msginfo);
	},

	_initId : function() {
		// TODO: get id from file if one exists - either here or probably elsewhere + inject
		var newId = id.generateNodeId();	
		logger.verbose('Generated new node ID ' + newId);
		return newId;
	}
});