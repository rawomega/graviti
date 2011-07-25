//
// This module anages low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and low (udp) level message sends / receives.
// Emits lifecycle events.
//
var logger = require('logmgr').getLogger('core/node');
var langutil = require('langutil');
var ringutil = require('ringutil');

Node = function Node() {
	this.nodeId = undefined;	
};

Node.prototype.init = function(port, bindAddr, opts) {		
	if (this.nodeId === undefined)
		this.nodeId = this._initId();
	else
		logger.warn('NOT initialising node id as it is set to ' + this.nodeId);
};

Node.prototype.set = function(newNodeId) {
	logger.info('Setting node id to ' + newNodeId);
	this.nodeId = newNodeId;
};

Node.prototype._initId = function() {
	// TODO: get id from file if one exists - either here or probably elsewhere + inject
	var newId = ringutil.generateNodeId();	
	logger.verbose('Generated new node ID ' + newId);
	return newId;
};

exports.Node = Node;