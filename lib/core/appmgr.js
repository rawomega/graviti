var fs = require('fs');
var winston = require('winston');

var self = module.exports = {
	apps : [],
	
	loadApps : function(appsDir) {
		fs.readdirSync(appsDir).forEach(function(a) {
			var appPath = a.replace(/\.js$/, '');
			winston.info('Loading app module ' + appPath);
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
				winston.warn('Found app without active()');
		}		
	},
	
	stopApps : function() {
		for (var i in self.apps) {
			var app = self.apps[i];
			if (app.passive)
				app.passive();
			else
				winston.warn('Found app without passive()');
		}
	}
};