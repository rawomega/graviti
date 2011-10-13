//
// Interface across specific transports (tcp, udp) 
//
var logger = require('logmgr').getLogger('transport');
var message = require('message');
var langutil = require('langutil');
var ringutil = require('ringutil');
var net = require('net');
var dgram = require("dgram");
var events = require('events');
var util = require('util');

exports.createStack = function(nodeId, port, bindAddr, router) {
	var udptran = new UdpTran(port, bindAddr);
	var tcptran = new TcpTran(port, bindAddr);
	return new TransportStack(nodeId, udptran, tcptran, router);
};

function TransportStack(nodeId, udptran, tcptran, router) {
    events.EventEmitter.call(this);

    this.maxUdpDatagramSize = 1400;
    this.nodeId = nodeId;
    this.udptran = udptran;
    this.tcptran = tcptran;
    this.router = router;

    this.pendingMessageResendQueue = [];
    this.unacknowledgedMessages = {};
    this.messageResendIntervals = [2000, 5000, 10000];    
}
util.inherits(TransportStack, events.EventEmitter);
exports.TransportStack = TransportStack;

TransportStack.prototype.start = function(callback) {
	var self = this;
	var tcpStarted = false;
	var udpStarted = false;

    this.messageResendIntervalId = setInterval(function() {
        var now = Date.now();
           while (self.pendingMessageResendQueue.length > 0
                   && self.pendingMessageResendQueue[0].retry_after < now) {
               var curr = self.pendingMessageResendQueue.shift();
               if (self.unacknowledgedMessages[curr.msg.msg_id] !== undefined) {                   
                   logger.verbose('Initiating resend of message ' + curr.msg.msg_id
                       + ' (retry ' + curr.retry_number + ') - now is ' + now
                       + ', retry_after is ' + curr.retry_after
                       + ', retry_initiated is ' + curr.retry_initiated
                       + ', unack is ' + self.unacknowledgedMessages[curr.msg.msg_id]);
                   self.sendMessage(curr.port, curr.host, curr.msg, curr.retry_number);
               }
           }
    }, 200);
	
	this.tcptran.start(self.receiveRaw.bind(this), function() {
		tcpStarted = true;
		if (udpStarted && callback)
			callback();
	});
	this.udptran.start(self.receiveRaw.bind(this), function() {
		udpStarted = true;
		if (tcpStarted && callback)
			callback();
	});
};

//
//Single message send to a uri. Uri's resource is hashed to form the destination id
TransportStack.prototype.send = function(destUri, content, headers) {
	this._send(destUri, content, headers);
};

//
//Send message directly to a specific known addr and port. Mainly for internal use 
TransportStack.prototype.sendToAddr = function(destUri, content, headers, addr, port) {
	var msg = new message.Message(destUri, content, headers);
	this.sendMessage(port, addr, msg);
};

//
//Send message directly to a specific id (as opposed to the hashed resource in the uri)
TransportStack.prototype.sendToId = function(destUri, content, headers, destId) {
	this._send(destUri, content, headers, undefined, undefined, destId);
};

//
//Internal send
TransportStack.prototype._send = function(destUri, content, headers, addr, port, destId) {
	if (destId === undefined)
		destId = ringutil.parseUri(destUri).hash;

	var msg = new message.Message(destUri, content, headers, destId);
	msg.source_id = this.nodeId;
	this._processMessage(msg);
};

TransportStack.prototype._processMessage = function(msg, msginfo) {
	if (this.router === undefined)
		throw new Error('Cannot process incoming or outgoing messages - no router has been set!');
	
	if (!msginfo) {
		msginfo = {
			app_name : ringutil.parseUri(msg.uri).app_name
		};
	}
	
	// figure out if this message is for us
	var isForThisNode = true;
	var nextHop = undefined;
	if (msg.dest_id !== undefined && msg.dest_id.length > 0) {			
		nextHop = this.router.getNextHop(msg.dest_id);
		if (nextHop.id !== this.nodeId) {
			logger.verbose((msg.source_id === this.nodeId ? 'Outbound' : 'En route') + ' forwarding message ' + msg.msg_id + ' to ' + msg.dest_id);
			isForThisNode = false;
		}
	}

	// if is for me, emit received, else emit forward
	if (isForThisNode) {
		logger.verbose('message for this node: uri ' + msg.uri + ', source ' + msg.source_id);
		try {
            if (msginfo.app_name === 'graviti')
				this.emit('graviti-message-received', msg, msginfo);
            else
				this.emit('app-message-received', msg, msginfo);
		} catch(e) {
			logger.error('Error delivering message received event: ' + e.stack);
		}
	} else {
		msginfo = langutil.extend(msginfo, {
			next_hop_id   : nextHop.id,
			next_hop_addr : nextHop.addr,
			next_hop_port : nextHop.port
		});
		try {
			if (msginfo.app_name === 'graviti') {
				this.emit('graviti-message-forwarding', msg, msginfo);
			} else {
				this.emit('app-message-forwarding', msg, msginfo);
			}
		} catch(e) {
			logger.error('Error delivering message forwarding event ' + e.stack);
		}
		this.sendMessage(msginfo.next_hop_port, msginfo.next_hop_addr, msg);

		// optionally, ping the sender to suggest a better hop
		if (msg.source_id !== this.nodeId) {				
			this.router.suggestBetterHop(msg, msginfo);
		}
	}
};

TransportStack.prototype.sendMessage = function(port, host, msg, retryNumber) {
    retryNumber = retryNumber || 0;
	if (msg.hops === undefined)
		msg.hops = 0;
	else
		msg.hops++;
	
	if (msg.source_id === undefined)
		msg.source_id = this.nodeId;
	
    // TODO: stop assuming udp and tcp ports same
	var myPort = this.udptran.port;
	if (msg.source_port === undefined)
		msg.source_port = myPort;
	msg.sender_port = myPort;
	
	var data = msg.stringify();
	logger.verbose('Sending raw message to ' + host + ':' + port + ' :\n' + data);
	
	if (data.length <= this.maxUdpDatagramSize)
		this.udptran.send(port, host, data);
	else {
        logger.verbose('Data length (' + data.length + ') exceeds max datagram size (' + this.maxUdpDatagramSize + ') - using TCP');
		this.tcptran.send(port, host, data);
	}

    if (retryNumber >= this.messageResendIntervals.length) {
        logger.verbose('Not scheduling more retries for message ' + msg.msg_id
            + ' since reached ' + existingResendInfo.retryNumber);
        delete this.unacknowledgedMessages[msg.msg_id];
        return;
    }
    
    if (msg instanceof message.Ack)
        return;

    langutil.pqInsert(this.pendingMessageResendQueue, {
        msg : msg,
        host : host,
        port : port,
        retry_number : retryNumber + 1,
        retry_initiated : Date.now(),
        retry_after : Date.now() + this.messageResendIntervals[retryNumber]
    }, 'retry_after');

    if (retryNumber === 0) {
        logger.verbose('Adding unacknowledged: ' + msg.msg_id + ', retry number ' + retryNumber);
        this.unacknowledgedMessages[msg.msg_id] = 0;
    }
};
	
TransportStack.prototype.receiveRaw = function(data, remoteAddress, inProgressState) {		
	var ack = message.parseAck(data);
	if (ack !== undefined) {
		logger.verbose('Received ACK for ' + ack.msg_id);
        delete this.unacknowledgedMessages[ack.msg_id];
		this.emit('message-ack', ack.msg_id);
		return;
	}
	
	var parsed = message.progressiveParse(data, inProgressState);
	if (!parsed.content_processed) {
		return parsed;
	}

	parsed.headers['method'] = parsed.method;
	var msg = new message.Message(parsed.uri, parsed.content, parsed.headers); 		
	logger.verbose('Message from ' + remoteAddress + ':' + msg.sender_port + ' :\n' + data);
	
	if (msg.source_port === undefined)
		throw new Error('Source port not found in received message');
	if (msg.source_addr === undefined)
		msg.source_addr = remoteAddress;

    this.sendMessage(msg.source_port, msg.source_addr, new message.Ack(msg.msg_id));
	
	if (msg.hops > 99)
		throw new Error('Too many hops (probable looping), discarding message ' + msg.msg_id);
	if (msg.sender_port === undefined)
		throw new Error('Sender port not found in received message');
	
	var msginfo = {
			source_ap : msg.source_addr + ':' + msg.source_port,
			sender_ap : remoteAddress + ':' + msg.sender_port		
	};
	
	var parsedUri = ringutil.parseUri(msg.uri);
	msginfo.app_name = parsedUri.app_name;
	this._processMessage(msg, msginfo);
	try {
		this.emit('message', msg, msginfo);
	} catch (e) {
		logger.error(e);
	}
};

TransportStack.prototype.stop = function() {
    clearInterval(this.messageResendIntervalId);
	this.tcptran.stop();
	this.udptran.stop();

    logger.info('Transport Stack stats:');
    logger.info('\tUnack messages:' + Object.keys(this.unacknowledgedMessages).length);
    logger.info('\tResend queue size: ' + this.pendingMessageResendQueue.length);

    this.unacknowledgedMessages = {};
    this.pendingMessageResendQueue = [];
};
exports.TransportStack = TransportStack;

//
//Sets up TCP socket for incoming messages
//
function TcpTran(port, bindAddr) {
	this.port = port;
	this.bindAddr = bindAddr;
	this.server = undefined;
	this.addrInUseRetryMsec = 3000;
	this.receivedDataCallback = undefined;
}
exports.TcpTran = TcpTran;

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
	
	self.server.on('connection', self._initSocket.bind(this));		
	self.server.on('close', function() {});
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
	this.getSocket (host + ':' + port,
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
		this.server = undefined;
	} catch(e) {
		logger.error('Error closing TCP listener: ' + e);
	}		
};

//
//Sets up UDP sockets for sending and receiving raw data
//
function UdpTran(port, bindAddr) {
	this.port = port;
	this.bindAddr = bindAddr;
	this.server = undefined;
	this.addrInUseRetryMsec = 3000;
	this.receivedDataCallback = undefined;
}
exports.UdpTran = UdpTran;

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
	if (!this.server)
		return;
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