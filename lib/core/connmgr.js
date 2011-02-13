var util = require('util');
var net = require('net');
var events = require('events');
var langutil = require('../common/langutil');
var uri = require('../common/uri');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	server : undefined,
	addrInUseRetryMsec : 3000,
	pool : {},
	
	listen : function(port, bindAddr, opts) {
		var listenCallback = function() {
			var svraddr = self.server.address();
			util.log('Server listening on ' + svraddr.address + ':' + svraddr.port);
			if (opts && opts.success)
				opts.success();
		};
		
		self.server = net.createServer();
		
		self.server.on('error', function (e) {
			if (e.code == 'EADDRINUSE') {
				util.log('Address in use -- will retry in ' + self.addrInUseRetryMsec + 'ms...');
				setTimeout(function () {
					self.server.close();
					self.server.listen(port, bindAddr, listenCallback);
				}, self.addrInUseRetryMsec);
			}
		});
		
		self.server.on('connection', function(socket) {
			socket.on('close', function() {
				util.log('Connection from ' + socket.remoteAddress + ' closed');
			}),
			socket.on('data', function(data) {
				var msg;
				try {
					msg = JSON.parse(data);
				} catch (e) {
					util.log('ERROR parsing message from ' + socket.remoteAddress + ': ' + data);
					return;
				}
				util.log('Message from ' + socket.remoteAddress + ':' + msg.source_port + ' : ' + data);
					
				if (msg.uri === undefined)
					throw new Error('No uri in received message'); 
				if (msg.hops > 99)
					throw new Error('Too many hops (probable looping), discarding message ' + msg.msg_id);
				
				var msginfo = {
						sender_addr : socket.remoteAddress,
						sender_port : msg.source_port				
				};
				
				var parsedUri = uri.parse(msg.uri);
				msginfo.app_name = parsedUri.app_name;
				
				self.emit('message', msg, msginfo);			
			});
		});
		
		self.server.on('close', function() {
			self.emit('close');
		})
		
		self.server.listen(port, bindAddr, listenCallback);
	},
	
	send : function(port, host, data) {
		var client = net.createConnection(port, host);
		client.setEncoding('UTF-8');
		client.addListener("connect", function() {
			client.write(data);
		});
		client.addListener("data", function(data) {
			util.log('client conn received data: ' + data);
		});
		client.addListener("close", function(data) {
			util.log('client conn closed');
		});
	},
	
	close : function() {
		self.server.close();
	}
});