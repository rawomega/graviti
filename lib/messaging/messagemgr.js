//
// Interface across specific transports (tcp, udp) 
//
var logger = require('logmgr').getLogger('messaging/messagemgr');
var tcptran = require('messaging/tcptran');
var udptran = require('messaging/udptran');

var self = module.exports = {
	maxUdpDatagramSize : 1400,
	port : undefined,
	
	start : function(port, bindAddr, receivedDataCallback, readyCallback) {
		self.port = port;
		var tcpStarted = false;
		var udpStarted = false;
		
		tcptran.start(port, bindAddr, receivedDataCallback, function() {
			tcpStarted = true;
			if (readyCallback && udpStarted)
				readyCallback();
		});
		udptran.start(port, bindAddr, receivedDataCallback, function() {
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
	
	stop : function() {		
		tcptran.stop();
		udptran.stop();
	}
};