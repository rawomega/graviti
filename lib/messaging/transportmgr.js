//
// Interface across specific transports (tcp, udp) 
//
var logger = require('logmgr').getLogger('messaging/transportmgr');
var messages = require('messaging/messages');
var uri = require('common/uri');
var events = require('events');
var util = require('util');

function TransportMgr(udptran, tcptran, messageparser) {
    events.EventEmitter.call(this);

    this.maxUdpDatagramSize = 1400;
    this.udptran = udptran;
    this.tcptran = tcptran;
    this.messageparser = messageparser;
    
    process.on('exit', this.stop);
}
util.inherits(TransportMgr, events.EventEmitter);

TransportMgr.prototype.start = function() {
	var self = this;
	var tcpStarted = false;
	var udpStarted = false;
	
	this.tcptran.start(self.receiveData, function() {
		tcpStarted = true;
		if (udpStarted)
			self.emit('ready');
	});
	this.udptran.start(self.receiveData, function() {
		udpStarted = true;
		if (tcpStarted)
			self.emit('ready');
	});
};

TransportMgr.prototype.send = function(port, host, msg) {
	if (msg.hops === undefined)
		msg.hops = 0;
	else
		msg.hops++;
	
	// TODO: assumes udp and tcp ports same
	var myPort = this.udptran.port;
	if (msg.source_port === undefined)
		msg.source_port = myPort;
	msg.sender_port = myPort;
	
	var data = msg.stringify();
	logger.verbose('Sending message to ' + host + ':' + port + ' :\n' + data);
	
	if (data.length <= this.maxUdpDatagramSize)
		this.udptran.send(port, host, data);
	else {
		logger.verbose('Packet length (' + data.length + ') exceeds max datagram size (' + this.maxUdpDatagramSize + ') - using TCP');
		this.tcptran.send(port, host, data);
	}
};
	
TransportMgr.prototype.receiveData = function(data, remoteAddress, inProgressState) {		
	var ack = this.messageparser.parseAck(data);
	if (ack !== undefined) {
		logger.verbose('Received ACK for ' + ack.msg_id);
		this.emit('message-ack', ack.msg_id);
		return;
	}
	
	var parsed = this.messageparser.progressiveParse(data, inProgressState);
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

	this.send(msg.source_port, msg.source_addr, new messages.Ack(msg.msg_id));
	
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
	this.emit('message', msg, msginfo);
};

TransportMgr.prototype.stop = function() {		
	this.tcptran.stop();
	this.udptran.stop();
};

exports.TransportMgr = TransportMgr;