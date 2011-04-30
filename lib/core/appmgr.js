var fs = require('fs');
var logger = require('logmgr').getLogger('core/appmgr');

var self = module.exports = {
	apps : [],
	
	loadApps : function(appsDir) {
		fs.readdirSync(appsDir).forEach(function(a) {
			var appPath = a.replace(/\.js$/, '');
			logger.info('Loading app module ' + appPath);
			var app = require(appPath);
			self.apps.push(app);
		});	
	},
	
	startApps : function() {
		for (var i in self.apps) {
			var app = self.apps[i];
			if (app.active)
				app.active();
			else
				logger.warn('Found app without active()');
		}		
	},
	
	stopApps : function() {
		for (var i in self.apps) {
			var app = self.apps[i];
			if (app.passive)
				app.passive();
			else
				logger.warn('Found app without passive()');
		}
	}
};