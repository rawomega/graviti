var logger = require('logmgr').getLogger('main');
var logmgr = require('logmgr');
var opts = require('opts');
var pastry = require('pastry');
var ringutil = require('ringutil');
var evalsvr = require('testability/evalsvr');
var echoapp = require('echoapp');

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
var testModePort = opts.get('test-mode');
var nodeId = opts.get('nodeid');

// set node id if needed
if (nodeId) {
	logger.info('Forcibly setting node id to ' + nodeId);
} else {
	nodeId = ringutil.generateNodeId();	
	logger.verbose('Generated new node ID ' + nodeId);
}

// start test mode server if required
if (testModePort !== undefined) {
	logger.info('Starting test server on port ' + testModePort);
	evalsvr.start(testModePort);
}

function logError(err, prefix) {
	if (err.stack)
		logger.error(prefix + err.stack);
	else if (err.message)
		logger.error(prefix + err.message);
	else {
		logger.error("Exception caught:");
		logger.error(err);
	}
}

//
// Let's get going
var echoApp;
var pastryNode = pastry.createNode(nodeId, port, bindAddr, function() {
	echoApp = new echoapp.EchoApp(pastryNode); 
	if (bootstraps)
		pastryNode.joinRing(bootstraps, function() {
			echoApp.start();
		});
	else
		pastryNode.startRing(function() {
			echoApp.start();
		});	
});

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
	logger.info('Got exit signal');
	if (echoApp)
		echoApp.stop();
	pastryNode.stop();
	if (testModePort)
		evalsvr.stop();
	logmgr.stop();
}