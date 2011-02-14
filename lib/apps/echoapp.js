var langutil = require('../common/langutil')
var util = require('util');
var app = require('../api/app');

var self = module.exports = langutil.extend(new app.GravitiApp('echoapp'), {
	intervalId : undefined,
	
	active : function() {
		self.intervalId = setInterval(function() {
			self.send('p2p:echoapp/hello', {greeting : 'hello'}, {method : 'POST'});
		}, 5000);
	},
	
	passive : function() {
		if (self.intervalId)
			clearInterval(self.intervalId);
	},
	
	message : function(msg, msginfo) {
		util.log('got greeting ' + msg.content.greeting);
		if (msg.content.greeting === 'hello')
			self.reply(msg, 'p2p:echoapp/hello', {greeting : 'hi'}, {method : 'POST'});
	},
	
	forwarding : function(msg, msginfo) {
	}
});