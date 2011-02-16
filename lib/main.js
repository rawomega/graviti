var opts = require('opts');
var util = require('util');
var ring = require('./api/ring');
var fs = require('fs');
var rootRelPath = '..'; // TODO: do away with relative paths

var exiting = false;

//
// Parse and apply command line options
var options = [ {
	'short': 'p',
	'long': 'port',
	description: 'Port this node will listen on',
	value: true
}, {
	'short': 'a',
	'long': 'address',
	description: 'Address to bind to',
	value: true
}, {
	'short': 'b',
	'long': 'bootstraps',
	description: 'Comma-separated list of bootstrap nodes',
	value: true
}, {
	'short': 'd',
	'long': 'apps-dir',
	description: 'Directory to load app files from',
	value: true
}];
opts.parse(options,true);
var bindAddr = opts.get('address') || '0.0.0.0';
var port = opts.get('port') || 4728;
var bootstraps = opts.get('bootstraps');
var appsDir = opts.get('apps-dir') || './apps';

//
// Handle exits etc
process.on('uncaughtException', function (err) {
	if (err.stack)
		util.log(err.stack);
	else if (err.message)
		util.log(err.message);
	else {
		util.log("Uncaught exception:");
		util.log(err);
	}
	
});
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
}

// prepare apps
var apps = [];
fs.readdirSync(appsDir).forEach(function(a) {
	var appPath = rootRelPath + '/' + appsDir + '/' + a.replace(/\.js$/, '');
	util.log('Loading app ' + appPath);
	var app = require(appPath);
	apps.push(app);
});

//
// Let's get going
if (bootstraps) {
	ring.join(port, bindAddr, apps, bootstraps);
} else {
	ring.start(port, bindAddr, apps);
}