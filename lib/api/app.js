var overlay = require('overlay/pastry/overlay');

var self = module.exports = {
	// constructor for a new app
	GravitiApp : function(name) {
		this.name = name,
		this.send = function(uri, content, headers) {
			// TODO: support sending to resource only (eg '/myresource')
			overlay.send(uri, content, headers);
		};
		this.reply = function(msg, uri, content, headers) {
			overlay.sendToId(uri, content, headers, msg.source_id);
		};
		
		var _this = this;
		overlay.on(name + '-app-message-received', function(msg, msginfo) {
			if (_this.message)
				_this.message(msg, msginfo);
		});
		overlay.on(name + '-app-message-forwarding', function(msg, msginfo) {
			if (_this.forwarding)
				_this.forwarding(msg, msginfo);
		});
		overlay.on('peer-departed', function(id) {
			if (_this.peerDeparted)
				_this.peerDeparted(id);
		});
		overlay.on('peer-arrived', function(id) {
			if (_this.peerArrived)
				_this.peerArrived(id);
		});
	}
};