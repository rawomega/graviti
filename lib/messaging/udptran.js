//
// Sets up UDP sockets for sending and receiving raw data
//
var logger = require('logmgr').getLogger('messaging/udptran');
var dgram = require("dgram");
var uri = require('common/uri');
var util = require('util');

UdpTran = function(port, bindAddr) {
	this.port = port;
	this.bindAddr = bindAddr;
	this.server = undefined;
	this.addrInUseRetryMsec = 3000;
	this.receivedDataCallback = undefined;
	
	process.on('exit', this.stop);
};

UdpTran.prototype.start = function(receivedDataCallback, readyCallback) {
	this.receivedDataCallback = receivedDataCallback;
	this._bind(readyCallback);
};

UdpTran.prototype._bind = function(readyCallback) {
	var self = this;
	var listenCallback = function() {
		var svraddr = self.server.address();
		logger.info('Listening to UDP on ' + svraddr.address + ':' + svraddr.port);
		if (readyCallback)
			readyCallback();
		else
			logger.warn('No UDP listening callback specified');
	};
	
	self.server = dgram.createSocket("udp4");
	
	self.server.on('error', function (e) {
		if (e.code == 'EADDRINUSE') {
			logger.warn('UDP address in use -- will retry in ' + self.addrInUseRetryMsec + 'ms...');
			setTimeout(function () {
				try {
					self.server.close();
				} catch (e) {
					logger.warn('UDP server did not close cleanly upon detection of addr in use: ' + e);
				}
				self.server.bind(self.port, self.bindAddr, listenCallback);
			}, self.addrInUseRetryMsec);
		} else if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
			logger.error('UNEXPECTED UDP error: ' + e.code);
		else
			logger.error(e);
	});
	
	self.server.on('message', function(raw, rinfo) {
		var data = new String(raw);
		try {
			var partiallyParsed = self.receivedDataCallback(data, rinfo.address, undefined);
		} catch (e) {
			logger.info('Error parsing message: ' + e);
		}		
		if (partiallyParsed)
			logger.warn('Failed to fully parse message: ' + data);
	});
	
	self.server.on("listening", listenCallback);
	self.server.bind(self.port, self.bindAddr);
};

UdpTran.prototype.send = function(port, host, data) {
	var buf = new Buffer(data);
	this.server.send (buf, 0, buf.length, port, host, function(err) {
		if (err)
			logger.error("Error sending packet of size " + data.length + " via UDP to " + host + ":" + port + ": " + err);
	});
};

UdpTran.prototype.stop = function() {		
	if (!this.server)
		return;
		
	try {
		this.server.close();
		this.server = undefined;
	} catch(e) {
		logger.error('Error closing UDP listener: ' + e);
	}		
};

exports.UdpTran = UdpTran;