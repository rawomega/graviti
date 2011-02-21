var overlay = require('core/overlay');
var appmgr = require('core/appmgr');
var util = require('util');

var self = module.exports = {
	apps : undefined,
	
	start : function(port, bindAddr) {
		overlay.init(port, bindAddr, function() {
			appmgr.startApps();
		});
	},
	
	join : function(port, bindAddr, bootstraps) {
		overlay.join(port, bindAddr, bootstraps, function() {
			appmgr.startApps();
		});
	},
	
	leave : function() {
		appmgr.stopApps();		
		overlay.leave();
	}
};