//
// This module anages low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and low (udp) level message sends / receives.
// Emits lifecycle events.
//
var dgram = require('dgram');
var util = require('util');
var langutil = require('../common/langutil');
var id = require('../common/id');
var uri = require('../common/uri');

var server = undefined;

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	// current node id
	nodeId : undefined,	

	//
	// Initializes this node. Essentially this means we bind to local addr + port.
	// We also set up parsing and emitting of received messages
	start : function(port, bindAddr, opts) {
		self.nodeId = self._initId();
		self.server = dgram.createSocket('udp4');
		self.server.on('listening', function() {
			var svraddr = self.server.address();
			util.log('Server listening on ' + svraddr.address + ':' + svraddr.port);
			if (opts && opts.success)
				opts.success();
		});
		
		self.server.on('message', function(content, rinfo) {
			util.log('Message from ' + rinfo.address + ':' + rinfo.port + ' : ' + content);
			var msg;
			try {
				msg = JSON.parse(content);
			} catch (e) {
				util.log('ERROR parsing message json: ' + content);
				return;
			}
				
			if (!msg.uri)
				throw new Error('No uri in received message'); 
			if (msg.hops > 99)
				throw new Error('Too many hops (probable looping), discarding message ' + msg.msg_id);
			
			var msginfo = {
					sender_addr : rinfo.address,
					sender_port : rinfo.port				
			};
			
			var parsedUri = uri.parse(msg.uri);
			msginfo.app_name = parsedUri.app_name;
			
			self.emit('message', msg, msginfo);
		});
		self.server.bind(port, bindAddr);
	},

	//
	// Orderly shutdown of this p2p node.
	stop : function() {
		util.log('Stopping node ' + self.nodeId);
		if (self.server) {
			self.server.close();
			self.server = undefined;
		}
		self.nodeId = undefined;
	},
	
	// Low-level send - serialize + push out
	send : function(addr, port, msg) {
		if (msg.hops === undefined)
			msg.hops = 0;
		else
			msg.hops++;
		
		var content = JSON.stringify(msg);
		util.log('Sending message to ' + addr + ':' + port + ' : ' + content);
		var buf = new Buffer(content);
		self.server.send(buf, 0, buf.length, port, addr);
	},

	_initId : function() {
		// todo: get id from file if one exists
		var newId = id.generateNodeId();	
		util.log('Generated new node ID ' + newId);
		return newId;
	}
});