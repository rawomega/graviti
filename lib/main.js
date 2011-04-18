var opts = require('opts');
var winston = require('winston');
var node = require('core/node');
var ring = require('api/ring');
var appmgr = require('core/appmgr');
var evalsvr = require('testability/evalsvr');

var exiting = false;
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {level: 'info'});

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
}, {
	"short" : 'n',
	'long' : 'nodeid',
	description : 'Node id to use for this node (useful for testing)',
	value : true
}];
opts.parse(options,true);
var bindAddr = opts.get('address') || '0.0.0.0';
var port = opts.get('port') || 4728;
var bootstraps = opts.get('bootstraps');
var appsDir = opts.get('apps-dir') || 'apps';
var testModePort = opts.get('test-mode');
var nodeId = opts.get('nodeid');

// set node id if needed
if (nodeId) {
	winston.info('Forcibly setting node id to ' + nodeId);
	node.nodeId = nodeId;
}

// load apps
appmgr.loadApps(appsDir);

// start test mode server if required
if (testModePort !== undefined) {
	winston.info('Starting test server on port ' + testModePort);
	evalsvr.start(testModePort);
}

function logError(err, prefix) {
	if (err.stack)
		winston.error(prefix + err.stack);
	else if (err.message)
		winston.error(prefix + err.message);
	else {
		winston.error("Exception caught:");
		winston.error(err);
	}
}

//
//Handle exits etc
process.on('uncaughtException', logError);
process.on('SIGHUP', shutdownNow);
process.on('SIGTERM', shutdownNow);
process.on('SIGINT', shutdownNow);
function shutdownNow(sig) {
	if (exiting)
		return;
	
	exiting = true;
	winston.info('Got exit signal');
	ring.leave();
	if (testModePort)
		evalsvr.stop();
}

//
// Let's get going
if (bootstraps) {
	ring.join(port, bindAddr, bootstraps);
} else {
	ring.start(port, bindAddr);
}