GravitiApp = function(name) {
	this.name = name;
};

GravitiApp.prototype.injectDeps = function(messagemgr, overlay) {
	this.overlay = overlay;			// injected by app manager
	this.messagemgr = messagemgr;	// injected by app manager
	
	var self = this;
	self.messagemgr.on(self.name + '-app-message-received', function(msg, msginfo) {
		if (self.message)
			self.message(msg, msginfo);
	});
	self.messagemgr.on(self.name + '-app-message-forwarding', function(msg, msginfo) {
		if (self.forwarding)
			self.forwarding(msg, msginfo);
	});
	self.overlay.on('peer-departed', function(id) {
		if (self.peerDeparted)
			self.peerDeparted(id);
	});
	self.overlay.on('peer-arrived', function(id) {
		if (self.peerArrived)
			self.peerArrived(id);
	});	
};

GravitiApp.prototype.send = function(uri, content, headers) {
	// TODO: support sending to resource only (eg '/myresource')
	this.messagemgr.send(uri, content, headers);
};

GravitiApp.prototype.reply = function(msg, uri, content, headers) {
	this.messagemgr.sendToId(uri, content, headers, msg.source_id);
};

exports.GravitiApp = GravitiApp;