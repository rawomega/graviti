//
// Interface across specific transports (tcp, udp) 
//
var logger = require('logmgr').getLogger('messaging/messagemgr');
var tcptran = require('messaging/tcptran');
var udptran = require('messaging/udptran');

var self = module.exports = {
	maxUdpDatagramSize : 1400,
	
	start : function(port, bindAddr, opts) {
		tcptran.start(port, bindAddr, opts);
		udptran.start(port, bindAddr, opts);
	},

	send : function(port, host, data) {
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