var net = require('net');
var logger = require('logmgr').getLogger('testability/evalsvr');

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
				logger.error('Could not start test server - address already in use: 127.0.0.1:' + port);
//				shutdownNow();
				process.exit();
			}
		});	
		self.server.on('connection', function(socket) {
			if (!(/(localhost|127.0.0.1)/i).test(socket.remoteAddress)) {
				logger.error('Rejecting test server connection from ' + socket.remoteAddress + ' - only local connections allowed');
				socket.end();
			}
			socket.on('close', function() {
				//logger.verbose('Test server: connection closed');
			});
			socket.on('error', function(err) {
				logger.error('Could not write to socket - error ' + err.message + '. Looks like the client has gone');
			});
			socket.on('data', function(data) {
				logger.info('[testsvr] : ' + data);
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
					logger.info('Test server: result: ' + JSON.stringify(res));
					socket.write(res);
				} else {
					logger.warn('Test server: func was unexpectedly empty');
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
			logger.info('Test server started on port ' + port);
		});	
	},
	
	stop : function() {
		if (self.server) {
			self.server.close();
		}
	},
	
	logError : function(err) {
		if (err.stack)
			logger.error('Test server error: ' + err.stack);
		else if (err.message)
			logger.error('Test server error: ' + err.message);
		else {
			logger.error("Test server error: " + err);
		}
	}
};