function EchoApp(node) {
	var self = this;
	this.node = node;
	this.intervalId = undefined;
	
	this.node.on('app-message-received', function(msg, msginfo) {
		if (msginfo.app_name === 'echoapp')
			self.message(msg, msginfo);
	});
}
exports.EchoApp = EchoApp;

EchoApp.prototype.start = function() {
	var self = this;
	self.intervalId = setInterval(function() {
		self.node.send('p2p:echoapp/hello', {greeting : 'hello'}, {method : 'POST'});
	}, 5000);
};

EchoApp.prototype.stop = function() {
	if (this.intervalId)
		clearInterval(this.intervalId);
};

EchoApp.prototype.message = function(msg, msginfo) {
	//console.log('got greeting ' + msg.content.greeting);
	if (msg.content.greeting === 'hello')
		this.node.reply(msg, 'p2p:echoapp/hello', {greeting : 'hi'}, {method : 'POST'});
};

EchoApp.prototype.forwarding = function(msg, msginfo) {
};

EchoApp.prototype.peerArrived = function(id) {		
};

EchoApp.prototype.peerDeparted = function(id) {		
};