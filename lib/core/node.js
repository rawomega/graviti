//
// This module anages low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and low (udp) level message sends / receives.
// Emits lifecycle events.
//
var logger = require('logmgr').getLogger('core/node');
var langutil = require('common/langutil');
var id = require('common/id');
var messagemgr = require('messaging/messagemgr');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	// current node id
	nodeId : undefined,	

	//
	// Initializes this node. Essentially this means we bind to local addr + port.
	// We also set up parsing and emitting of received messages
	start : function(port, bindAddr, opts) {		
		if (self.nodeId === undefined)
			self.nodeId = self._initId();

		messagemgr.start(port, bindAddr, function() {
			if (opts && opts.success)
				opts.success();
		});
	},

	//
	// Orderly shutdown of this p2p node.
	stop : function() {
		logger.info('Stopping node ' + self.nodeId);
		messagemgr.stop();
	},

	_initId : function() {
		// TODO: get id from file if one exists - either here or probably elsewhere + inject
		var newId = id.generateNodeId();	
		logger.verbose('Generated new node ID ' + newId);
		return newId;
	}
});