var winston = require('winston');
var node = require('core/node');
var leafset = require('core/leafset');
var routingtable = require('core/routingtable');
var langutil = require('common/langutil');

var self = module.exports = {
	overlayCallback : undefined,
	heartbeatCheckIntervalId : undefined,
	heartbeatCheckIntervalMsec : 1000,
	heartbeatIntervalMsec : 10000,
	timedOutPeerCheckIntervalId : undefined,
	timedOutPeerCheckIntervalMsec : 2500,
	routingTableCandidateCheckIntervalId : undefined,
	routingTableCandidateCheckIntervalMsec : 1000,
	routingTableMaintenanceIntervalId : undefined,
	routingTableMaintenanceIntervalMsec : 15 * 60 * 1000,

	start : function(overlayCallback) {
		self.overlayCallback = overlayCallback;
		self.overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		
		self.heartbeatCheckIntervalId = setInterval(function() {
			self._sendPendingHeartbeats();
		}, self.heartbeatCheckIntervalMsec);
		
		self.timedOutPeerCheckIntervalId = setInterval(function() {
			self._purgeTimedOutAndDeadPeers();
		}, self.timedOutPeerCheckIntervalMsec);
		
		self.routingTableCandidateCheckIntervalId = setInterval(function() {
			self._probeCandidateRoutingTablePeers();
		}, self.routingTableCandidateCheckIntervalMsec);
		
		self.routingTableMaintenanceIntervalId = setInterval(function() {
			self._initiateRoutingTableMaintenance();
		}, self.routingTableMaintenanceIntervalMsec);
	},
	
	stop : function(notifyPeers) {
		if (notifyPeers === undefined)
			notifyPeers = true;
		
		if (self.heartbeatCheckIntervalId)
			clearInterval(self.heartbeatCheckIntervalId);
		if (self.timedOutPeerCheckIntervalId)
			clearInterval(self.timedOutPeerCheckIntervalId);
		if (self.routingTableCandidateCheckIntervalId)
			clearInterval(self.routingTableCandidateCheckIntervalId);
		if (self.routingTableMaintenanceIntervalId)			
			clearInterval(self.routingTableMaintenanceIntervalId);
		
		// send bye to peers
		if (notifyPeers) {
			leafset.each(function(id, item) {
				var ap = item.ap.split(':');
				self.overlayCallback.sendToAddr('p2p:graviti/peers/' + node.nodeId, undefined, {method : 'DELETE'}, ap[0], ap[1]);			
			});			
		}
		
		self.overlayCallback.removeListener('graviti-message-received', self._handleReceivedGravitiMessage);
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
			self._handleReceivedHeartbeat(msg, msginfo);
		} else if (/\/peers\/\w+/.test(msg.uri) && msg.method === 'DELETE') {
			self._handleDepartingPeer(msg, msginfo);
		}
	},
	
	_sendPendingHeartbeats : function() {
		leafset.each(self._sendHeartbeatToLeafsetPeer);
		leafset.eachCandidate(self._sendHeartbeatToLeafsetPeer);			
	},
	
	_sendHeartbeatToLeafsetPeer : function(id, peer) {
		if (peer.lastHeartbeatSent > (Date.now() - self.heartbeatIntervalMsec))
			return;
		
		winston.verbose('Heartbeating to leafset peer ' + id + ' (' + peer.ap + ')');
		var ap = peer.ap.split(':');
		var now = Date.now();
		self.sendHeartbeatToAddr(ap[0], ap[1], {
				leafset : leafset.compressedLeafset(),
				rsvp_with : now
		});
		peer.lastHeartbeatSent = now;
	},
	
	sendHeartbeatToAddr : function(addr, port, content) {
		self.overlayCallback.sendToAddr('p2p:graviti/heartbeat', content, {method : 'POST'}, addr, port);
	},
	
	_handleReceivedHeartbeat : function(msg, msginfo) {
		winston.verbose('Received heartbeat from ' + msg.source_id);
		leafset.updateWithKnownGood(msg.source_id, msginfo.source_ap);
		
		if (msg.content.leafset !== undefined) {
			leafset.updateWithProvisional(msg.content.leafset);
		}
		if (msg.content.routing_table !== undefined) {
			routingtable.mergeProvisional(msg.content.routing_table);
		}
		
		if (msg.content.rsvp_with !== undefined) {
			routingtable.updateWithProvisional(msg.source_id, msginfo.source_ap);
			var content = {
					rsvp_echo : msg.content.rsvp_with
			};
			if (msg.content.leafset !== undefined)
				content.leafset = leafset.compressedLeafset();
			if (msg.content.routing_table !== undefined)
				content.routing_table = routingtable.getSharedRow(msg.source_id);
			
			winston.verbose('Responding to heartbeat from ' + msg.source_id + ' (' + msginfo.source_ap + ')');
			var ap = msginfo.source_ap.split(':');
			self.sendHeartbeatToAddr(ap[0], ap[1], content);
			var p = leafset.peer(msg.source_id);
			if (p !== undefined)
				p.lastHeartbeatSent = Date.now();
		} else if (msg.content.rsvp_echo !== undefined && msg.content.routing_table !== undefined) {
			var provisionalPeer = routingtable._candidatePeers[msg.source_id];
			if (provisionalPeer === undefined || provisionalPeer.lastProbedAt !== msg.content.rsvp_echo)
				return;

			var roundTripTimeMillis = Date.now() - provisionalPeer.lastProbedAt;
			routingtable.updateWithKnownGood(msg.source_id, msginfo.source_ap, roundTripTimeMillis);
		} else {
			routingtable.updateWithProvisional(msg.source_id, msginfo.source_ap);
		}
	},
	
	_handleDepartingPeer : function(msg, msginfo) {
		var id = msg.uri.replace(/.*\/peers\//, '').replace(/\//, '');
		winston.verbose('Received departing peer notice for ' + id + ' (' + msginfo.source_ap + ')');
		leafset.removePeer(id);		
	},
	
	_purgeTimedOutAndDeadPeers : function() {
		leafset.clearExpiredDeadAndCandidatePeers();
		leafset.clearTimedOutPeers();
		
		routingtable.housekeep();
	},
	
	_probeCandidateRoutingTablePeers : function() {
		routingtable.eachCandidate(function(id, peer) {
			if (peer.lastProbedAt !== undefined)
				return;
			
			winston.verbose('Probing routing table candidate ' + id + ' (' + peer.ap + ')'); 
			var ap = peer.ap.split(':');
			var now = Date.now();
			self.sendHeartbeatToAddr(ap[0], ap[1], {
					routing_table: routingtable.getSharedRow(id),
					rsvp_with : now
			});
			peer.lastProbedAt = now;
		})		
	},
	
	//
	// Run periodically to select a random peer from each routing table row, and send it
	// that row from this node's table. See PAS paper for more.
	_initiateRoutingTableMaintenance : function() {
		routingtable.eachRow(function(row, peers) {
			var digits = Object.keys(peers);
			if (digits.length < 1)
				return;
			
			var digitIndex = Math.floor(Math.random() * digits.length);
			var peer = peers[digits[digitIndex]];
			routingtable.updateWithProvisional(peer.id, peer.ap, true);
		});
	}
};