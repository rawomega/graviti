//
// Sets up UDP sockets for sending and receiving raw data
//
var logger = require('logmgr').getLogger('messaging/udptran');
var dgram = require("dgram");
var events = require('events');
var langutil = require('common/langutil');
var uri = require('common/uri');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	server : undefined,
	addrInUseRetryMsec : 3000,
	receivedDataCallback : undefined,
	
	start : function(port, bindAddr, opts) {
		self.receivedDataCallback = opts && opts.receivedDataCallback;
		self._bind(port, bindAddr, opts && opts.listeningCallback);
	},
	
	_bind : function(port, bindAddr, listeningCallback) {
		var listenCallback = function() {
			var svraddr = self.server.address();
			logger.info('Server listening on ' + svraddr.address + ':' + svraddr.port);
			if (listeningCallback)
				listeningCallback();
			else
				logger.warn('No listening callback specified');
		};
		
		self.server = dgram.createSocket("udp4");
		
		self.server.on('error', function (e) {
			if (e.code == 'EADDRINUSE') {
				logger.warn('Address in use -- will retry in ' + self.addrInUseRetryMsec + 'ms...');
				setTimeout(function () {
					try {
						self.server.close();
					} catch (e) {
						logger.warn('Server did not close cleanly upon detection of addr in use: ' + e);
					}
					self.server.bind(port, bindAddr, listenCallback);
				}, self.addrInUseRetryMsec);
			} else if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
				logger.verbose('Connection error: ' + e.code);
			else
				logger.error(e);
		});
		
		self.server.on('message', self._processReceived);
		self.server.on("listening", listenCallback);
		self.server.bind(port, bindAddr);
	},
	
	_processReceived : function(raw, rinfo) {
		var data = new String(raw);

		try {
			var partiallyParsed = self.receivedDataCallback(data, rinfo.address, undefined);
		} catch (e) {
			logger.info('Error parsing message: ' + e);
		}		
		if (partiallyParsed)
			logger.warn('Failed to fully parse message: ' + data);
	},
	
	send : function(port, host, data) {
		var buf = new Buffer(data);
		self.server.send (buf, 0, buf.length, port, host, function(err) {
			if (err)
				logger.error("Error sending packet: " + err);
		});
	},
	
	stop : function() {		
		if (!self.server)
			return;
			
		try {
			self.server.close();
		} catch(e) {
			logger.error('Error closing listener: ' + e);
		}		
	}
});