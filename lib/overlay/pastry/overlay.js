var logger = require('logmgr').getLogger('overlay/pastry/overlay');
var node = require('core/node');
var uri = require('common/uri');
var langutil = require('common/langutil');
var bootstrapmgr = require('overlay/pastry/bootstrapmgr');
var heartbeater = require('overlay/pastry/heartbeater');
var leafset = require('overlay/pastry/leafset');
var routingmgr = require('overlay/pastry/routingmgr');
var routingtable = require('overlay/routingtable');
var messages = require('messaging/messages');
var transportmgr = require('messaging/transportmgr');

//
// Manages overlay membership
var self = module.exports = {
	join : function(port, bindAddr, bootstraps, emitter, readyCallback) {
		leafset.on('peer-arrived', function(id) {
			emitter.emit('peer-arrived', id);
		});
		leafset.on('peer-departed', function(id) {
			emitter.emit('peer-departed', id);
		});
		bootstrapmgr.on("bootstrap-completed", function() {
			if (readyCallback)
				readyCallback();
		});

		bootstrapmgr.start(self, bootstraps);
		heartbeater.start(self);
		if (!bootstraps)
			readyCallback();
	},

	stop : function() {
		bootstrapmgr.stop();
		heartbeater.stop();
	}
};