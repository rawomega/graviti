var net = require('net');
var util = require('util');

//
// This is a dumb noddy JS server that accepts a function definition from a client,
// executes (evals) it, and writes the result back to the socket as JSON.
// It is intended for helping with automated integration testing. It only accepts
// connections from the local machine.
// -- Use with caution -- for obvious reasons! 

var self = module.exports = {
	server : undefined,
	socket : undefined,
	
	start : function(port) {
		self.server = net.createServer();
		self.server.on('error', function (e) {
			if (e.code == 'EADDRINUSE') {
				util.log('Could not start test server - address already in use: 127.0.0.1:' + port);
				shutdownNow();
				process.exit();
			}
		});	
		self.server.on('connection', function(newsocket) {
			if (self.socket) {
				util.log('Rejecting test server connection from ' + newsocket.remoteAddress + ' - connection already established, only one connection allowed');
				newsocket.end();
			}
			if (!(/(localhost|127.0.0.1)/i).test(newsocket.remoteAddress)) {
				util.log('Rejecting test server connection from ' + newsocket.remoteAddress + ' - only local connections allowed');
				newsocket.end();
			}
			self.socket = newsocket;
			self.socket.on('close', function() {
				util.log('Test server: connection closed');
				self.socket = undefined;
			});
			self.socket.on('data', function(data) {
				util.log('[testsvr] : ' + data);
				var funcDef = '' + data;
				var func;
				try {
					func = eval(funcDef);
				} catch (e) {
					self.logError(e, 'Test server: error evaluating function : ');
					self.socket.write(JSON.stringify({ error : e }));
					self.socket.end();
					return;
				}
				if (func) {
					var res;
					try {
						res = JSON.stringify(func());
					} catch (e) {
						self.logError(e, 'Test server: error executing function : ');
						self.socket.write(JSON.stringify({ error : e }));
						self.socket.end();
						return;
					}
					if (!res)
						res = {};
					self.socket.write(res);
				}
				self.socket.end();
			});
		});
		self.server.on('close', function() {
			if (self.socket) {
				self.socket.end();
				self.socket = undefined;
			}
			self.server = undefined;
		});	
		self.server.listen(port, '127.0.0.1');	
	},
	
	stop : function() {
		if (self.server) {
			self.server.close();
		}
	},
	
	logError : function(err) {
		if (err.stack)
			util.log('Test server error: ' + err.stack);
		else if (err.message)
			util.log('Test server error: ' + err.message);
		else {
			util.log("Test server error: " + err);
		}
	}
};