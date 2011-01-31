var opts = require('opts');
var overlay = require('./overlay');
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
var port = opts.get('port') || 4728;
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
	overlay.leave();
}

//
// Let's get going
if (bootstraps) {
	overlay.join(port, address, bootstraps);
} else {
	overlay.init(port, address);
}