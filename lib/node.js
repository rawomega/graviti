if (global.GENTLY) require = GENTLY.hijack(require);
var dgram = require('dgram');
var mod_id = require('./id');

//
// Manager low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and one-off message sends / receives.
// Emits lifecycle events.

module.exports = {
	server : undefined,
	nodeId : undefined,
	
	start : function(port, address) {
		this.nodeId = this._initId();
		this.server = dgram.createSocket('udp4');
		var _this = this;
		this.server.on('listening', function() {
			var svraddr = _this.server.address();
			console.log('Server listening on ' + svraddr.address + ':' + svraddr.port);
		});
		this.server.on('message', function(msg, rinfo) {
			console.log('Message from ' + rinfo.address + ':' + rinfo.port + ' : ' + msg);
			// TODO: publish event
		});
		this.server.bind(port, address);
	},
	
	stop : function() {
		console.log('Stopping node ' + this.nodeId);
		if (this.server) {
			this.server.close();
			this.server = undefined;
		}
		this.nodeId = undefined;
	},

	send : function(addr, port, msg) {
		var content = JSON.stringify(msg);
		console.log('Sending message: ' + content);
		var buf = new Buffer(content);
		this.server.send(buf, 0, buf.length, port, addr);
	},
	
	_initId : function() {
		// todo: get id from file if one exists
		var newId = mod_id.generateNodeId();	
		console.log('Generated new node ID ' + newId);
		return newId;
	}
};
