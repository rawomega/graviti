var overlay = require('../core/overlay');
var langutil = require('../common/langutil');

//
// Provides a best-effort messaging service to p2p applications
var self = module.exports = langutil.extend(new events.EventEmitter(), {
	send : function(destUri, content, headers, opts) {
		var defs = {
			resend_until_ack : true,
			resend_timeout_sec : 60,
			resend_initial_delay_msec : 1000,
			resend_backoff_factor : 100
		};
		var options = langutil.extend(defs, opts);
	
		// todo: implement backoff retries, a little randomization etc.
		
		overlay.send(destUri, content, headers);
	}
});

// 'fan out' message received events on a per-app basis
overlay.on('app-message-received', function(msg, msginfo) {
	console.log('ccc');
	self.emit('message-received:' + msginfo.app_name, msg, msginfo);
});
overlay.on('app-message-forwarding', function(msg, msginfo) {
	console.log('jjjj');
	self.emit('message-forwarding:' + msginfo.app_name, msg, msginfo);
});