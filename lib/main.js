var opts = require('opts');
var mod_node = require('./node');
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
}];
opts.parse(options,true);
var address = opts.get('address') || '0.0.0.0';
var port = opts.get('port') || 8124;
var bootstraps = opts.get('bootstraps');

//
// Handle exits etc
//process.on('uncaughtException', function (err) {
//  console.log('Caught exception: ' + err);
//});
process.on('SIGHUP', shutdownNow);
process.on('SIGTERM', shutdownNow);
process.on('SIGINT', shutdownNow);
function shutdownNow(sig) {
	if (exiting) {
		return;
	}
	exiting = true;
	console.log('Got exit signal');
	mod_node.stop();
}

//
// Let's get going
mod_node.start(port, address, bootstraps);
