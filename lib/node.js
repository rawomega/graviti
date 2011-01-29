if (global.GENTLY) require = GENTLY.hijack(require);
var dgram = require('dgram');
var mod_id = require('./id');
var overlay = require('./overlay');

//
// Manager low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and one-off message sends / receives.
// Emits lifecycle events.

module.exports = {
	server : undefined,
	nodeId : undefined,
	start : function(port, address, bootstraps) {
		this.nodeId = this.getId();
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
		if (bootstraps)
			overlay.join(bootstraps);
		else
			console.log('No bootstraps --> started own ring');
	},
	stop : function() {
		console.log('Stopping node ' + this.nodeId);
		if (this.server) {
			this.server.close();
			this.server = undefined;
		}
		this.nodeId = undefined;
	},
	send : function(destUri, content, opts) {
		var defs = {
			method: 'GET',
			resend_until_ack : true,
			resend_timeout_sec : 60,
			resend_initial_delay_msec : 1000,
			resend_backoff_factor : 100
		};
		var options = Object.create(defs, opts);

		var msg = {
			msg_id : mod_id.generateUuid(),
			source : this.nodeId,
			dest : dest,
			created : new Date().getTime(),
			method : options.method,
			resource : resource,
			content : content
			// todo: correlation, transaction ids
		};

		// todo: add to send queue, manage retries, timeouts, resp / ack correlation
		console.log('Sending message: ' + JSON.stringify(msg));
		var buf = new Buffer(msg);
		this.server.send(buf, 0, buf.length, destPort, destHost);
	},
	getId : function() {
		// todo: get id from file if one exists
		var newId = mod_id.generateNodeId();	
		console.log('Generated new node ID ' + newId);
		return newId;
	}
};
