var overlay = require('../core/overlay');

var self = module.exports = {
	// constructor for a new app
	GravitiApp : function(name) {
		this.name = name,
		this.send = function(uri, content, headers) {
			// TODO: support sending to virtual dir only
			overlay.send(uri, content, headers);
		};
		this.reply = function(msg, uri, content, headers) {
			overlay.sendToId(uri, content, headers, msg.source_id);
		};
		
		var _this = this;
		overlay.on(name + '-app-message-received', function(msg, msginfo) {
			_this.message(msg, msginfo);
		});
		overlay.on(name + '-app-message-forwarding', function(msg, msginfo) {
			_this.forwarding(msg, msginfo);
		});
	}
};