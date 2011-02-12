var messenger = require('../core/messenger');

var self = module.exports = {
	// constructor for a new app
	GravitiApp : function(name) {
		this.name = name,
		this.send = function(uri, content, headers) {
			// TODO: support sending to virtual dir only
			messenger.send(uri, content, headers);
		};
		this.reply = function(msg, uri, content, headers) {
			messenger.reply(msg, uri, content, headers);
		}
		
		var _this = this;
		messenger.on('message-received:' + name, function(msg, msginfo) {
			_this.message(msg, msginfo);
		});
		messenger.on('message-forwarding:' + name, function(msg, msginfo) {
			_this.forwarding(msg, msginfo);
		});
	}
};