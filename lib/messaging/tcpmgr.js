//
// Sets up UDP socket for incoming messages
//
var logger = require('logmgr').getLogger('messaging/tcpmgr');
var net = require('net');
var events = require('events');
var langutil = require('common/langutil');
var uri = require('common/uri');
var messenger = require('messaging/messenger');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	server : undefined,
	addrInUseRetryMsec : 3000,
	receivedDataCallback : undefined,
//	socketTimeoutMsec : 60 * 1000,
	
	start : function(port, bindAddr, opts) {
		self.receivedDataCallback = opts && opts.receivedDataCallback;
		self._listen(port, bindAddr, opts && opts.listeningCallback);
	},
	
	_listen : function(port, bindAddr, listeningCallback) {
		var listenCallback = function() {
			var svraddr = self.server.address();
			logger.info('Server listening on ' + svraddr.address + ':' + svraddr.port);
			if (listeningCallback)
				listeningCallback();
			else
				logger.warn('No listening callback specified');
		};
		
		self.server = net.createServer();
		
		self.server.on('error', function (e) {
			if (e.code == 'EADDRINUSE') {
				logger.warn('Address in use -- will retry in ' + self.addrInUseRetryMsec + 'ms...');
				setTimeout(function () {
					try {
						self.server.close();
					} catch (e) {
						logger.warn('Server did not close cleanly upon detection of addr in use: ' + e);
					}
					self.server.listen(port, bindAddr, listenCallback);
				}, self.addrInUseRetryMsec);
			} else if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
				logger.verbose('Connection error: ' + e.code);
			else
				logger.error(e);
		});
		
		self.server.on('connection', self._initSocket);		
		self.server.on('close', function() {})		
		self.server.listen(port, bindAddr, listenCallback);
	},
	
	_initSocket : function(socket) {
		socket.on('close', function() {});
		socket.on('data', function(raw) {
			self._processReceived(raw, socket);
		});
	},
	
	_processReceived : function(raw, socket) {
		var data = new String(raw);
		try {
			var partiallyParsed = self.receivedDataCallback(data, socket.remoteAddress, socket.existingParsed);
		} catch (e) {
			logger.info('Failed to parse message: ' + e);
		}
		socket.existingParsed = partiallyParsed;	// either sets or clears
		if (!partiallyParsed)
			socket.end();
	},
	
	getSocket : function(ap, success, error) {
		var apArr = ap.split(':');
		var socket = net.createConnection(apArr[1], apArr[0]);
		socket.setEncoding('UTF-8');
		socket.on('error', function(e) {
			if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
				logger.verbose('Connection error: ' + e.code);
			else
				error(e);
		});
		socket.on("connect", function() {
			success(socket);
		});
		self._initSocket(socket);
	},
	
	send : function(port, host, data) {
		self.getSocket ( host + ':' + port,
			function(socket) {
				socket.write(data, 'UTF8', function() {});
			},
			function(err) {
				logger.error('Connection error: ' + err);					
			}
		);
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