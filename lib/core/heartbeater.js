var util = require('util');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');

var self = module.exports = {
	overlayCallback : undefined,
	heartbeatIntervalId : undefined,
	heartbeatIntervalMsec : 2000,
	
	start : function(overlayCallback) {
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		
		self.heartbeatIntervalId = setInterval(function() {
			self._sendHeartbeats();
		}, self.heartbeatIntervalMsec);
	},
	
	stop : function() {
		if (self.heartbeatIntervalId)
			clearInterval(self.heartbeatIntervalId);
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
			self._handleReceivedHeartbeat(msg, msginfo);
		}
	},
	
	_sendHeartbeats : function() {		
		var content = {
			leafset : leafsetmgr.leafset,
			routing_table : routingmgr.routingTable
		};
		for (var targetId in leafsetmgr.leafset) {
			var ap = leafsetmgr.leafset[targetId].split(':');
			self.overlayCallback.sendToAddr('p2p:graviti/heartbeat', content, {method : 'POST'}, ap[0], ap[1]);
		}
	},
	
	_handleReceivedHeartbeat : function(msg, msginfo) {
		util.log('Received heartbeat from ' + msg.source_id);
		leafsetmgr.updateLeafset(msg.content.leafset);
		routingmgr.mergeRoutingTable(msg.content.routing_table);
	},
};