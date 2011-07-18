//
// Sets up TCP socket for incoming messages
//
var logger = require('logmgr').getLogger('messaging/tcptran');
var net = require('net');
var uri = require('common/uri');
var util = require('util');

TcpTran = function(port, bindAddr) {
	this.port = port;
	this.bindAddr = bindAddr;
	this.server = undefined;
	this.addrInUseRetryMsec = 3000;
	this.receivedDataCallback = undefined;	
};

TcpTran.prototype.start = function(receivedDataCallback, readyCallback) {
	this.receivedDataCallback = receivedDataCallback;
	this._listen(readyCallback);
};

TcpTran.prototype._listen = function(readyCallback) {
	var self = this;
	var listenCallback = function() {
		var svraddr = self.server.address();
		logger.info('Listening to TCP on ' + svraddr.address + ':' + svraddr.port);
		if (readyCallback)
			readyCallback();
		else
			logger.warn('No tcp listening callback specified');
	};
	
	self.server = net.createServer();
	
	self.server.on('error', function (e) {
		if (e.code == 'EADDRINUSE') {
			logger.warn('TCP address in use -- will retry in ' + self.addrInUseRetryMsec + 'ms...');
			setTimeout(function () {
				try {
					self.server.close();
				} catch (e) {
					logger.warn('TCP server did not close cleanly upon detection of addr in use: ' + e);
				}
				self.server.listen(self.port, self.bindAddr, listenCallback);
			}, self.addrInUseRetryMsec);
		} else if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
			logger.verbose('TCP connection error: ' + e.code);
		else
			logger.error(e);
	});
	
	self.server.on('connection', self._initSocket);		
	self.server.on('close', function() {})		
	self.server.listen(self.port, self.bindAddr, listenCallback);
};

TcpTran.prototype._initSocket = function(socket) {
	var self = this;
	socket.on('close', function() {});
	socket.on('data', function(raw) {
		self._processReceived(raw, socket);
	});
};

TcpTran.prototype._processReceived = function(raw, socket) {
	var data = new String(raw);
	try {
		var partiallyParsed = this.receivedDataCallback(data, socket.remoteAddress, socket.existingParsed);
	} catch (e) {
		logger.info('Failed to parse message: ' + e);
	}
	socket.existingParsed = partiallyParsed;	// either sets or clears
	if (!partiallyParsed)
		socket.end();
};

TcpTran.prototype.getSocket = function(ap, success, error) {
	var apArr = ap.split(':');
	var socket = net.createConnection(apArr[1], apArr[0]);
	socket.setEncoding('UTF-8');
	socket.on('error', function(e) {
		if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
			logger.verbose('TCP connection error: ' + e.code);
		else
			error(e);
	});
	socket.on("connect", function() {
		success(socket);
	});
	this._initSocket(socket);
};

TcpTran.prototype.send = function(port, host, data) {
	this.getSocket ( host + ':' + port,
		function(socket) {
			socket.write(data, 'UTF8', function() {});
		},
		function(err) {
			logger.error('TCP connection error: ' + err);					
		}
	);
};

TcpTran.prototype.stop = function() {		
	if (!this.server)
		return;
		
	try {
		this.server.close();
	} catch(e) {
		logger.error('Error closing TCP listener: ' + e);
	}		
};

exports.TcpTran = TcpTran;