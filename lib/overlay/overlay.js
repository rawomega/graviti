var logger = require('logmgr').getLogger('overlay/overlay');
var node = require('core/node');
var uri = require('common/uri');
var langutil = require('common/langutil');
var messages = require('messaging/messages');
var transportmgr = require('messaging/transportmgr');
var pastryoverlay = require('overlay/pastry/overlay');

//
// Manages overlay membership
var self = module.exports = langutil.extend(new events.EventEmitter(), {
	//
	// Initialise ourselves as the first node in a ring
	init : function(port, bindAddr, readyCallback) {
		self.join(port, bindAddr, undefined, readyCallback);
	},

	//
	// Join an existing ring via specified bootstraps
	join : function(port, bindAddr, bootstraps, readyCallback) {
		transportmgr.start(port, bindAddr, function() {
			pastryoverlay.join(port, bindAddr, bootstraps, self, readyCallback);			
		});
	},
	
	//
	// Leave the overlay, if we're part of it. Do this nicely, by letting
	// other nodes know, then tear down the node and exit.
	leave : function() {
		logger.info('Stopping node ' + node.nodeId);
		pastryoverlay.stop();
		transportmgr.stop();
	},
});