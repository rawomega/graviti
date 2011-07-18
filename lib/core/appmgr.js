var logger = require('logmgr').getLogger('core/appmgr');
var fs = require('fs');

AppMgr = function() {
	this.apps = [];
};

AppMgr.prototype.loadApps = function(appsDir) {
	var self = this;
	fs.readdirSync(appsDir).forEach(function(a) {
		var appPath = a.replace(/\.js$/, '');
		logger.info('Loading app module ' + appPath);
		var app = require(appPath);
		self.apps.push(app);
	});	
};
	
AppMgr.prototype.startApps = function() {
	for (var i in this.apps) {
		var app = this.apps[i];
		if (app.active)
			app.active();
		else
			logger.warn('Found app without active()');
	}		
};
	
AppMgr.prototype.stopApps = function() {
	for (var i in this.apps) {
		var app = this.apps[i];
		if (app.passive)
			app.passive();
		else
			logger.warn('Found app without passive()');
	}
};

exports.AppMgr = AppMgr;