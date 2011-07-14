var overlay = require('overlay/pastry/overlay');
var appmgr = require('core/appmgr');

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