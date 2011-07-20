var overlay = require('overlay/overlay');
var appmgr = require('core/appmgr');

Ring = function(overlay, appmgr) {
	this.overlay = overlay;
	this.appmgr = appmgr;
};

Ring.prototype.start = function() {
	this.overlay.init(function() {
		this.appmgr.startApps();
	});
};
	
Ring.prototype.join = function(bootstraps) {
	this.overlay.join(bootstraps, function() {
		this.appmgr.startApps();
	});
};

exports.Ring = Ring;