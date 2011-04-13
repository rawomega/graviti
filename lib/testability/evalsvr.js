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
	maxConnections : 20,
	
	start : function(port) {
		self.server = net.createServer();
		self.server.maxConnections = self.maxConnections;
		self.server.on('error', function (e) {
			if (e.code == 'EADDRINUSE') {
				util.log('Could not start test server - address already in use: 127.0.0.1:' + port);
//				shutdownNow();
				process.exit();
			}
		});	
		self.server.on('connection', function(socket) {
			if (!(/(localhost|127.0.0.1)/i).test(socket.remoteAddress)) {
				util.log('Rejecting test server connection from ' + socket.remoteAddress + ' - only local connections allowed');
				socket.end();
			}
			socket.on('close', function() {
				//util.log('Test server: connection closed');
			});
			socket.on('error', function(err) {
				util.log('Could not write to socket - error ' + err.message + '. Looks like the client has gone');
			});
			socket.on('data', function(data) {
				util.log('[testsvr] : ' + data);
				var funcDef = '' + data;
				var func;
				try {
					func = eval(funcDef);
				} catch (e) {
					self.logError(e, 'Test server: error evaluating function : ');
					socket.write(JSON.stringify({ error : e }));
					socket.end();
					return;
				}
				if (func) {
					var res = 'true';
					try {
						var evalRes = func();
						if (evalRes !== undefined)
							res = JSON.stringify(evalRes);
					} catch (e) {
						self.logError(e, 'Test server: error executing function : ');
						socket.write(JSON.stringify({ error : e }));
						socket.end();
						return;
					}
					util.log('Test server: result: ' + JSON.stringify(res));
					socket.write(res);
				} else {
					util.log('Test server: func was unexpectedly empty');
				}
				socket.end();
			});
		});
		self.server.on('close', function() {
			self.server = undefined;
		});	
		self.server.listen(port, '127.0.0.1', function() {
			// note that the following string is matched by integration tests to indicate server ready to
			// receive test commands
			util.log('Test server started on port ' + port);
		});	
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