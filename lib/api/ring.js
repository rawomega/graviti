var overlay = require('../core/overlay');
var util = require('util');

var self = module.exports = {
	apps : undefined,
	
	start : function(port, bindAddr, apps) {
		overlay.init(port, bindAddr, function() {
			self._startApps(apps);
		});
	},
	
	join : function(port, bindAddr, apps, bootstraps) {
		overlay.join(port, bindAddr, bootstraps, function() {
			self._startApps(apps);
		});
	},
	
	_startApps : function(apps) {
		self.apps = apps;
		for (var i in apps) {
			var app = apps[i];
			if (app.active)
				app.active();
			else
				util.log('Found app without active()');
		}		
	},
	
	leave : function() {
		for (var i in self.apps) {
			var app = self.apps[i];
			if (app.passive)
				app.passive();
			else
				util.log('Found app without passive()');
		}
		
		overlay.leave();
	}
};