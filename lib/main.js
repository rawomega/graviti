var opts = require('opts');
var util = require('util');
var ring = require('api/ring');
var fs = require('fs');
var net = require('net');

var exiting = false;

//
// Parse and apply command line options
var options = [ {
	'short': 'p',
	'long': 'port',
	description: 'Port this node will listen on',
	value : true
}, {
	'short': 'a',
	'long': 'address',
	description: 'Address to bind to',
	value : true
}, {
	'short': 'b',
	'long': 'bootstraps',
	description: 'Comma-separated list of bootstrap nodes',
	value : true
}, {
	'short': 'd',
	'long': 'apps-dir',
	description: 'Directory to load app files from',
	value : true
}, {
	'short' : 't',
	'long' : 'test-mode',
	description : 'Run in test mode, with socket server on specified port',
	value : true
}];
opts.parse(options,true);
var bindAddr = opts.get('address') || '0.0.0.0';
var port = opts.get('port') || 4728;
var bootstraps = opts.get('bootstraps');
var appsDir = opts.get('apps-dir') || 'apps';
var testModePort = opts.get('test-mode');

// prepare apps
var apps = [];
fs.readdirSync(appsDir).forEach(function(a) {
	var appPath = a.replace(/\.js$/, '');
	util.log('Loading app ' + appPath);
	var app = require(appPath);
	apps.push(app);
});

// start test mode server if required
var server;
var socket;
if (testModePort !== undefined) {
	server = net.createServer();
	server.on('error', function (e) {
		if (e.code == 'EADDRINUSE') {
			util.log('Could not start test server - address already in use: 127.0.0.1:' + testModePort);
			shutdownNow();
			process.exit();
		}
	});	
	server.on('connection', function(newsocket) {
		if (socket) {
			util.log('Rejecting test server connection from ' + newsocket.remoteAddress + ' - connection already established, only one connection allowed');
			newsocket.end();
		}
		if (!(/(localhost|127.0.0.1)/i).test(newsocket.remoteAddress)) {
			util.log('Rejecting test server connection from ' + newsocket.remoteAddress + ' - only local connections allowed');
			newsocket.end();
		}
		socket = newsocket;
		socket.on('close', function() {
			util.log('Test server: connection closed');
		});
		socket.on('data', function(data) {
			util.log('[testsvr] : ' + data);
			var funcDef = 'f=' + data;
			var func;
			try {
				func = eval(funcDef);
			} catch (e) {
				logError(e, 'Test server: error evaluating function : ');
				socket.write(JSON.stringify({ error : e }));
				return;
			}
			if (func) {
				var res;
				try {
					res = JSON.stringify(func());
				} catch (e) {
					logError(e, 'Test server: error executing function : ');
					socket.write(JSON.stringify({ error : e }));
					return;
				}
				if (!res)
					res = {};
				socket.write(res);
			}
		});
	});
	server.on('close', function() {
		if (socket) {
			socket.end();
		}
	});	
	server.listen(testModePort, '127.0.0.1');	
}

function logError(err, prefix) {
	if (err.stack)
		util.log(prefix + err.stack);
	else if (err.message)
		util.log(prefix + err.message);
	else {
		util.log("Exception caught:");
		util.log(err);
	}
}

//
//Handle exits etc
process.on('uncaughtException', logError);
process.on('SIGHUP', shutdownNow);
process.on('SIGTERM', shutdownNow);
process.on('SIGINT', shutdownNow);
function shutdownNow(sig) {
	if (exiting) {
		return;
	}
	exiting = true;
	util.log('Got exit signal');
	ring.leave();
	if (server)
		server.close();
}

//
// Let's get going
if (bootstraps) {
	ring.join(port, bindAddr, apps, bootstraps);
} else {
	ring.start(port, bindAddr, apps);
}