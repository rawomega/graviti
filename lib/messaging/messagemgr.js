//
// Interface across specific transports (tcp, udp) 
//
var logger = require('logmgr').getLogger('messaging/messagemgr');
var tcptran = require('messaging/tcptran');
var udptran = require('messaging/udptran');
var messageparser = require('messaging/messageparser');
var messages = require('messaging/messages');
var uri = require('common/uri');
var langutil = require('common/langutil');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	maxUdpDatagramSize : 1400,
	port : undefined,
	
	start : function(port, bindAddr, readyCallback) {
		self.port = port;
		var tcpStarted = false;
		var udpStarted = false;
		
		tcptran.start(port, bindAddr, self.receiveData, function() {
			tcpStarted = true;
			if (readyCallback && udpStarted)
				readyCallback();
		});
		udptran.start(port, bindAddr, self.receiveData, function() {
			udpStarted = true;
			if (readyCallback && tcpStarted)
				readyCallback();
		});
	},

	send : function(port, host, msg) {
		if (msg.hops === undefined)
			msg.hops = 0;
		else
			msg.hops++;
		
		if (msg.source_port === undefined)
			msg.source_port = self.port;
		msg.sender_port = self.port;
		
		var data = msg.stringify();
		logger.verbose('Sending message to ' + host + ':' + port + ' :\n' + data);
		
		if (data.length <= self.maxUdpDatagramSize)
			udptran.send(port, host, data);
		else {
			logger.verbose('Packet length (' + data.length + ') exceeds max datagram size (' + self.maxUdpDatagramSize + ') - using TCP');
			tcptran.send(port, host, data);
		}
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

		self.send(msg.source_port, msg.source_addr, new messages.Ack(msg.msg_id));
		
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

	
	stop : function() {		
		tcptran.stop();
		udptran.stop();
	}
});