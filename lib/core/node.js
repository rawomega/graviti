//
// This module anages low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and low (udp) level message sends / receives.
// Emits lifecycle events.
//
var logger = require('logmgr').getLogger('core/node');
var langutil = require('common/langutil');
var id = require('common/id');

var self = module.exports = {
	nodeId : undefined,

	init : function(port, bindAddr, opts) {		
		if (self.nodeId === undefined)
			self.nodeId = self._initId();
		else
			logger.warn('NOT initialising node id as it is set to ' + self.nodeId);
	},

	set : function(newNodeId) {
		logger.info('Setting node id to ' + newNodeId);
		self.nodeId = newNodeId;
	},

	_initId : function() {
		// TODO: get id from file if one exists - either here or probably elsewhere + inject
		var newId = id.generateNodeId();	
		logger.verbose('Generated new node ID ' + newId);
		return newId;
	}
};