var logger = require('logmgr').getLogger('core/appmgr');
var fs = require('fs');
var app = require('api/app')

AppMgr = function(messagemgr, overlay) {
	this.messagemgr = messagemgr;
	this.overlay = overlay;
	this.apps = [];
};

AppMgr.prototype.loadApps = function(appsDir) {
	var self = this;
	fs.readdirSync(appsDir).forEach(function(a) {
		var appPath = a.replace(/\.js$/, '');
		logger.info('Loading app module ' + appPath);
		var appMod = require(appPath);
		var appInstances = self._instantiateModuleApps(appMod);
		self.apps = self.apps.concat(appInstances);
	});	
};

AppMgr.prototype._instantiateModuleApps = function(appMod) {
	var self = this;
	var instances = [];
	Object.keys(appMod).forEach(function(key) {
		if (typeof(appMod[key]) === 'function' && appMod[key].prototype instanceof app.GravitiApp) {
			var instance = new appMod[key]();
			instance.injectDeps(self.messagemgr, self.overlay);
			instances.push(instance);
		}
	});
	return instances;
};

AppMgr.prototype.startApps = function() {
	for (var i in this.apps) {
		var app = this.apps[i];
		app.messagemgr = this.messagemgr;
		app.overlay = this.overlay;
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