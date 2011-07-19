var logger = require('logmgr').getLogger('overlay/pastry/overlay');
var events = require('events');

//
// Manages overlay membership
Overlay = function(leafset, bootstrapmgr, heartbeater) {
	events.EventEmitter.call(this);
	
	this.leafset = leafset;
	this.bootstrapmgr = bootstrapmgr;
	this.heartbeater = heartbeater;
};
util.inherits(Overlay, events.EventEmitter);

Overlay.prototype.init = function(readyCallback) {
	this.join(undefined, readyCallback);
};

Overlay.prototype.join = function(bootstraps, readyCallback) {
	var self = this;
	self.leafset.on('peer-arrived', function(id) {
		self.emit('peer-arrived', id);
	});
	self.leafset.on('peer-departed', function(id) {
		self.emit('peer-departed', id);
	});

	self.bootstrapmgr.start(bootstraps, function() {
		if (readyCallback)
			readyCallback();
	});
	self.heartbeater.start();
	if (!bootstraps && readyCallback)
		readyCallback();
};

Overlay.prototype._handleBootstrapCompleted = 

exports.Overlay = Overlay;