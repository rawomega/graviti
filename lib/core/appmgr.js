var fs = require('fs');
var util = require('util');

var self = module.exports = {
	apps : [],
	
	loadApps : function(appsDir) {
		fs.readdirSync(appsDir).forEach(function(a) {
			var appPath = a.replace(/\.js$/, '');
			util.log('Loading app module ' + appPath);
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
				util.log('Found app without active()');
		}		
	},
	
	stopApps : function() {
		for (var i in self.apps) {
			var app = self.apps[i];
			if (app.passive)
				app.passive();
			else
				util.log('Found app without passive()');
		}
	}
};