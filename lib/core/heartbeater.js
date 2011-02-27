var util = require('util');
var node = require('core/node');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');
var langutil = require('common/langutil');

var self = module.exports = langutil.extend(new events.EventEmitter(), {
	overlayCallback : undefined,
	heartbeatCheckIntervalId : undefined,
	heartbeatCheckIntervalMsec : 1000,
	heartbeatIntervalMsec : 10000,
	timedOutPeerCheckIntervalId : undefined,
	timedOutPeerCheckIntervalMsec : 2500,
	timedOutPeerIntervalMsec : 35000,
	
	start : function(overlayCallback) {
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		
		self.heartbeatCheckIntervalId = setInterval(function() {
			self._sendPendingHeartbeats();
		}, self.heartbeatCheckIntervalMsec);
		
		self.timedOutPeerCheckIntervalId = setInterval(function() {
			self._purgeTimedOutPeers();
		}, self.timedOutPeerCheckIntervalMsec);
	},
	
	stop : function() {
		if (self.heartbeatCheckIntervalId)
			clearInterval(self.heartbeatCheckIntervalId);
		if (self.timedOutPeerCheckIntervalId)
			clearInterval(self.timedOutPeerCheckIntervalId);
		
		// send bye to peers
		for (var id in leafsetmgr.leafset) {
			var ap = leafsetmgr.leafset[id].ap.split(':');
			self.overlayCallback.sendToAddr('p2p:graviti/peers/' + node.nodeId, undefined, {method : 'DELETE'}, ap[0], ap[1]);
		}
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
			self._handleReceivedHeartbeat(msg, msginfo);
		} else if (/\/peers\/\w+/.test(msg.uri) && msg.method === 'DELETE') {
			self._handleDepartingPeer(msg, msginfo);
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
		leafsetmgr.updateLeafset(msg.source_id, msginfo.sender_addr + ':' + msginfo.sender_port);
		routingmgr.mergeRoutingTable(msg.content.routing_table);
	},
	
	_handleDepartingPeer : function(msg, msginfo) {
		var id = msg.uri.replace(/.*\/peers\//, '').replace(/\//, '');
		util.log('Received departing peer notice for ' + id + ' (' + msginfo.sender_addr +  ':' + msginfo.sender_port + ')');
		delete leafsetmgr.leafset[id];
		self.emit('peer-departed', id);
	},
	
	_purgeTimedOutPeers : function() {
		for (var id in leafsetmgr.leafset) {
			if (leafsetmgr.leafset[id].lastHeartbeatReceived < (new Date().getTime() - self.timedOutPeerIntervalMsec)) {
				util.log('Found timed out peer ' + id + ' (' + leafsetmgr.leafset[id].ap + ')');
				delete leafsetmgr.leafset[id];
				self.emit('peer-departed', id);
			}
		}
	}
});