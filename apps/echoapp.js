var util = require('util')
var app = require('api/app');

EchoApp = function() {
	app.GravitiApp.call(this, 'echoapp');
	this.intervalId = undefined;
};
util.inherits(EchoApp, app.GravitiApp);

EchoApp.prototype.active = function() {
	var self = this;
	self.intervalId = setInterval(function() {
		self.send('p2p:echoapp/hello', {greeting : 'hello'}, {method : 'POST'});
	}, 5000);
};

EchoApp.prototype.passive = function() {
	if (this.intervalId)
		clearInterval(this.intervalId);
};

EchoApp.prototype.message = function(msg, msginfo) {
	//console.log('got greeting ' + msg.content.greeting);
	if (msg.content.greeting === 'hello')
		this.reply(msg, 'p2p:echoapp/hello', {greeting : 'hi'}, {method : 'POST'});
};

EchoApp.prototype.forwarding = function(msg, msginfo) {
};

EchoApp.prototype.peerArrived = function(id) {		
};

EchoApp.prototype.peerDeparted = function(id) {		
};

exports.EchoApp = EchoApp