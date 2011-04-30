//
// Sets up listener for incoming messages, and tcp connections for sending outgoing messages
//

var logger = require('logmgr').getLogger('core/connmgr');
var net = require('net');
var events = require('events');
var langutil = require('common/langutil');
var uri = require('common/uri');
var messenger = require('core/messenger');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	server : undefined,
	addrInUseRetryMsec : 3000,
	pool : {},
	
	listen : function(port, bindAddr, opts) {
		var listenCallback = function() {
			var svraddr = self.server.address();
			logger.info('Server listening on ' + svraddr.address + ':' + svraddr.port);
			if (opts && opts.success)
				opts.success();
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
		
		self.server.on('connection', function(socket) {
			socket.on('close', function() {}),
			socket.on('data', function(data) {				
				self._processReceivedData(socket, data);
			});
		});
		
		self.server.on('close', function() {
			self.emit('close');
		})
		
		self.server.listen(port, bindAddr, listenCallback);
	},
	
	_processReceivedData : function(socket, data) {
		var raw = new String(data);
		var msg;
		try {
			var parsed = messenger.progressiveParse(raw, socket.existingParsed);
			if (!parsed.content_processed) {
				socket.existingParsed = parsed;
				return;
			}
			socket.existingParsed = undefined;
			parsed.headers['method'] = parsed.method;
			msg = new messenger.Message(parsed.uri, parsed.content, parsed.headers); 
		} catch (e) {
			logger.warn('Failed to parse message from ' + socket.remoteAddress + ': ' + e + '\nReceived:\n' + data);
			return;
		}
		logger.verbose('Message from ' + socket.remoteAddress + ':' + msg.sender_port + ' :\n' + data);
			
		if (msg.hops > 99)
			throw new Error('Too many hops (probable looping), discarding message ' + msg.msg_id);
		if (msg.source_port === undefined)
			throw new Error('Source port not found in received message');
		if (msg.sender_port === undefined)
			throw new Error('Sender port not found in received message');
		if (msg.source_addr === undefined)
			msg.source_addr = socket.remoteAddress;
		
		var msginfo = {
				source_ap : msg.source_addr + ':' + msg.source_port,
				sender_ap : socket.remoteAddress + ':' + msg.sender_port		
		};
		
		var parsedUri = uri.parse(msg.uri);
		msginfo.app_name = parsedUri.app_name;
		self.emit('message', msg, msginfo);
	},
	
	send : function(port, host, data) {
		var client = net.createConnection(port, host);
		client.setEncoding('UTF-8');
		client.addListener('error', function(e) {
			if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')
				logger.verbose('Connection error: ' + e.code);
			else
				logger.error(e);
		});
		client.addListener("connect", function() {
			client.write(data, 'UTF8', function() {
				client.end();
			});
		});
		client.addListener("data", function(data) {
			logger.warn('Client conn unexpectedly received data: ' + data);
		});
		client.addListener("close", function(data) {});
	},
	
	stopListening : function() {
		if (!self.server)
			return;
			
		try {
			self.server.close();
		} catch(e) {
			logger.error('Error closing listener: ' + e);
		}
	}
});