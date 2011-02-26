var util = require('util');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');

var self = module.exports = {
	overlayCallback : undefined,
	heartbeatCheckIntervalId : undefined,
	heartbeatCheckIntervalMsec : 1000,
	heartbeatIntervalMsec : 10000,
	
	start : function(overlayCallback) {
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		
		self.heartbeatCheckIntervalId = setInterval(function() {
			self._sendPendingHeartbeats();
		}, self.heartbeatCheckIntervalMsec);
	},
	
	stop : function() {
		if (self.heartbeatCheckIntervalId) {
			clearInterval(self.heartbeatCheckIntervalId);
		}
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
			self._handleReceivedHeartbeat(msg, msginfo);
		}
	},
	
	_sendPendingHeartbeats : function() {
		var content = undefined;
		for (var targetId in leafsetmgr.leafset) {
			var lastHeartbeatSent = leafsetmgr.leafset[targetId].lastHeartbeatSent;
			if (lastHeartbeatSent > (new Date().getTime() - self.heartbeatIntervalMsec))
				continue;
			
			if (content === undefined) content = {
				leafset : leafsetmgr.compressedLeafset(),
				routing_table : routingmgr.routingTable
			};
			var ap = leafsetmgr.leafset[targetId].ap.split(':');
			self.overlayCallback.sendToAddr('p2p:graviti/heartbeat', content, {method : 'POST'}, ap[0], ap[1]);
			leafsetmgr.leafset[targetId].lastHeartbeatSent = new Date().getTime();
		}
	},
	
	_handleReceivedHeartbeat : function(msg, msginfo) {
		util.log('Received heartbeat from ' + msg.source_id);
		leafsetmgr.updateLeafset(msg.content.leafset);
		routingmgr.mergeRoutingTable(msg.content.routing_table);
	},
};