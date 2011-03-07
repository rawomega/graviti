var util = require('util');
var node = require('core/node');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');
var langutil = require('common/langutil');

var self = module.exports = {
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
			self._purgeTimedOutAndDeadPeers();
		}, self.timedOutPeerCheckIntervalMsec);
	},
	
	stop : function(notifyPeers) {
		if (notifyPeers === undefined)
			notifyPeers = true;
		
		if (self.heartbeatCheckIntervalId)
			clearInterval(self.heartbeatCheckIntervalId);
		if (self.timedOutPeerCheckIntervalId)
			clearInterval(self.timedOutPeerCheckIntervalId);
		
		// send bye to peers
		if (notifyPeers) {
			leafsetmgr.each(function(id, item) {
				var ap = item.ap.split(':');
				self.overlayCallback.sendToAddr('p2p:graviti/peers/' + node.nodeId, undefined, {method : 'DELETE'}, ap[0], ap[1]);			
			});			
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
		leafsetmgr.each(self._sendHeartbeatToLeafsetPeer);
		leafsetmgr.eachCandidate(self._sendHeartbeatToLeafsetPeer);			
	},
	
	_sendHeartbeatToLeafsetPeer : function(id, peer) {		
		var lastHeartbeatSent = peer.lastHeartbeatSent;
		if (lastHeartbeatSent > (new Date().getTime() - self.heartbeatIntervalMsec))
			return;
			
		var ap = peer.ap.split(':');
		self._sendHeartbeatToAddr(ap[0], ap[1], true);
		peer.lastHeartbeatSent = new Date().getTime();
	},
	
	_sendHeartbeatToAddr : function(addr, port, rsvp) {
		var content =  {
				leafset : leafsetmgr.compressedLeafset(),
				routing_table : routingmgr.routingTable
		};
		if (rsvp)
			content.rsvp = true;
		self.overlayCallback.sendToAddr('p2p:graviti/heartbeat', content, {method : 'POST'}, addr, port);
	},
	
	_handleReceivedHeartbeat : function(msg, msginfo) {
		util.log('Received heartbeat from ' + msg.source_id + (msg.content.rsvp ? ', will respond immediately as found rsvp flag' : ''));
		leafsetmgr.updateWithProvisional(msg.content.leafset);
		leafsetmgr.updateWithKnownGood(msg.source_id, msginfo.sender_addr + ':' + msginfo.sender_port);
		routingmgr.mergeRoutingTable(msg.content.routing_table);
		
		if (msg.content.rsvp === true) {
			self._sendHeartbeatToAddr(msginfo.sender_addr, msginfo.sender_port);
			var p = leafsetmgr.peer[msg.source_id];
			if (p !== undefined)
				p.lastHeartbeatSent = new Date().getTime();
		}
	},
	
	_handleDepartingPeer : function(msg, msginfo) {
		var id = msg.uri.replace(/.*\/peers\//, '').replace(/\//, '');
		util.log('Received departing peer notice for ' + id + ' (' + msginfo.sender_addr +  ':' + msginfo.sender_port + ')');
		leafsetmgr.removePeer(id);		
	},
	
	_purgeTimedOutAndDeadPeers : function() {
		leafsetmgr.clearExpiredDeadAndCandidatePeers();
		leafsetmgr.each(function(id, item) {
			if (item.lastHeartbeatReceived < (new Date().getTime() - self.timedOutPeerIntervalMsec)) {
				util.log('Found timed out peer ' + id + ' (' + item.ap + ')');
				leafsetmgr.removePeer(id);				
			}
		});
	}
};