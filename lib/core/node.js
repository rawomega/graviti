//
// This module anages low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and low (udp) level message sends / receives.
// Emits lifecycle events.
//
var util = require('util');
var connmgr = require('core/connmgr');
var langutil = require('common/langutil');
var id = require('common/id');
var uri = require('common/uri');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	// current node id
	nodeId : undefined,	
	port : undefined,

	//
	// Initializes this node. Essentially this means we bind to local addr + port.
	// We also set up parsing and emitting of received messages
	start : function(port, bindAddr, opts) {
		self.port = port;
		self.nodeId = self._initId();

		connmgr.on('message', function(msg, msginfo) {
			self.emit('message', msg, msginfo);			
		});		
		connmgr.listen(port, bindAddr, opts);
	},

	//
	// Orderly shutdown of this p2p node.
	stop : function() {
		util.log('Stopping node ' + self.nodeId);
		connmgr.on('close', function() {
			self.nodeId = undefined;			
		})
		connmgr.stopListening();
	},
	
	// Low-level send - serialize + push out
	send : function(addr, port, msg) {
		if (msg.hops === undefined)
			msg.hops = 0;
		else
			msg.hops++;
		
		msg.source_port = self.port;
		
		var content = JSON.stringify(msg);
		util.log('Sending message to ' + addr + ':' + port + ' : ' + content);
		connmgr.send(port, addr, content);
	},

	_initId : function() {
		// todo: get id from file if one exists
		var newId = id.generateNodeId();	
		util.log('Generated new node ID ' + newId);
		return newId;
	}
});
