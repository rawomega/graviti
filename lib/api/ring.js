var overlay = require('overlay/overlay');
var appmgr = require('core/appmgr');

module.exports = {	
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