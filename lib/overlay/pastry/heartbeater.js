var logger = require('logmgr').getLogger('overlay/pastry/heartbeater');
var node = require('core/node');
var langutil = require('common/langutil');

exports.heartbeatCheckIntervalMsec = 1000;
exports.heartbeatIntervalMsec = 10000;
exports.timedOutPeerCheckIntervalMsec = 2500;
exports.routingTableCandidateCheckIntervalMsec = 1000;
exports.routingTableMaintenanceIntervalMsec = 15 * 60 * 1000;

Heartbeater = function(messagemgr, leafset, routingtable) {
	this.messagemgr = messagemgr;
	this.leafset = leafset;
	this.routingtable = routingtable;
	this.heartbeatCheckIntervalId = undefined;
	this.timedOutPeerCheckIntervalId = undefined;
	this.routingTableCandidateCheckIntervalId = undefined;
	this.routingTableMaintenanceIntervalId = undefined;
	this.messagemgr.on('graviti-message-received', this._handleReceivedGravitiMessage.bind(this));
};

Heartbeater.prototype.start = function() {
	var self = this;
	
	self.heartbeatCheckIntervalId = setInterval(function() {
		self._sendPendingHeartbeats();
	}, exports.heartbeatCheckIntervalMsec);
	
	self.timedOutPeerCheckIntervalId = setInterval(function() {
		self._purgeTimedOutAndDeadPeers();
	}, exports.timedOutPeerCheckIntervalMsec);
	
	self.routingTableCandidateCheckIntervalId = setInterval(function() {
		self._probeCandidateRoutingTablePeers();
	}, exports.routingTableCandidateCheckIntervalMsec);
	
	self.routingTableMaintenanceIntervalId = setInterval(function() {
		self._initiateRoutingTableMaintenance();
	}, exports.routingTableMaintenanceIntervalMsec);
};

Heartbeater.prototype.stop = function(notifyPeers) {
	var self = this;
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
		self.leafset.each(function(id, item) {
			var ap = item.ap.split(':');
			self.messagemgr.sendToAddr('p2p:graviti/peers/' + node.nodeId, undefined, {method : 'DELETE'}, ap[0], ap[1]);			
		});			
	}
	
	self.messagemgr.removeListener('graviti-message-received', self._handleReceivedGravitiMessage);
};

Heartbeater.prototype._handleReceivedGravitiMessage = function(msg, msginfo) {
	if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
		this._handleReceivedHeartbeat(msg, msginfo);
	} else if (/\/peers\/\w+/.test(msg.uri) && msg.method === 'DELETE') {
		this._handleDepartingPeer(msg, msginfo);
	}
};

Heartbeater.prototype._sendPendingHeartbeats = function() {
	this.leafset.each(this._sendHeartbeatToLeafsetPeer.bind(this));
	this.leafset.eachCandidate(this._sendHeartbeatToLeafsetPeer.bind(this));			
};

Heartbeater.prototype._sendHeartbeatToLeafsetPeer = function(id, peer) {
	if (peer.lastHeartbeatSent > (Date.now() - exports.heartbeatIntervalMsec))
		return;
	
	logger.verbose('Heartbeating to leafset peer ' + id + ' (' + peer.ap + ')');
	var ap = peer.ap.split(':');
	var now = Date.now();
	this.sendHeartbeatToAddr(ap[0], ap[1], {
			leafset : this.leafset.compressedLeafset(),
			rsvp_with : now
	});
	peer.lastHeartbeatSent = now;
};

Heartbeater.prototype.sendHeartbeatToAddr = function(addr, port, content) {
	this.messagemgr.sendToAddr('p2p:graviti/heartbeat', content, {method : 'POST'}, addr, port);
};

Heartbeater.prototype._handleReceivedHeartbeat = function(msg, msginfo) {
	logger.verbose('Received heartbeat from ' + msg.source_id);
	this.leafset.updateWithKnownGood(msg.source_id, msginfo.source_ap);
	
	if (msg.content.leafset !== undefined) {
		this.leafset.updateWithProvisional(msg.content.leafset);
	}
	if (msg.content.routing_table !== undefined) {
		this.routingtable.mergeProvisional(msg.content.routing_table);
	}
	
	if (msg.content.rsvp_with !== undefined) {
		this.routingtable.updateWithProvisional(msg.source_id, msginfo.source_ap);
		var content = {
				rsvp_echo : msg.content.rsvp_with
		};
		if (msg.content.leafset !== undefined)
			content.leafset = this.leafset.compressedLeafset();
		if (msg.content.routing_table !== undefined)
			content.routing_table = this.routingtable.getSharedRow(msg.source_id);
		
		logger.verbose('Responding to heartbeat from ' + msg.source_id + ' (' + msginfo.source_ap + ')');
		var ap = msginfo.source_ap.split(':');
		this.sendHeartbeatToAddr(ap[0], ap[1], content);
		var p = this.leafset.peer(msg.source_id);
		if (p !== undefined)
			p.lastHeartbeatSent = Date.now();
	} else if (msg.content.rsvp_echo !== undefined && msg.content.routing_table !== undefined) {
		var provisionalPeer = this.routingtable._candidatePeers[msg.source_id];
		if (provisionalPeer === undefined || provisionalPeer.lastProbedAt !== msg.content.rsvp_echo)
			return;

		var roundTripTimeMillis = Date.now() - provisionalPeer.lastProbedAt;
		this.routingtable.updateWithKnownGood(msg.source_id, msginfo.source_ap, roundTripTimeMillis);
	} else {
		this.routingtable.updateWithProvisional(msg.source_id, msginfo.source_ap);
	}
};

Heartbeater.prototype._handleDepartingPeer = function(msg, msginfo) {
	var id = msg.uri.replace(/.*\/peers\//, '').replace(/\//, '');
	logger.verbose('Received departing peer notice for ' + id + ' (' + msginfo.source_ap + ')');
	this.leafset.removePeer(id);		
};

Heartbeater.prototype._purgeTimedOutAndDeadPeers = function() {
	this.leafset.clearExpiredDeadAndCandidatePeers();
	this.leafset.clearTimedOutPeers();
	
	this.routingtable.housekeep();
};

Heartbeater.prototype._probeCandidateRoutingTablePeers = function() {
	var self = this;
	self.routingtable.eachCandidate(function(id, peer) {
		if (peer.lastProbedAt !== undefined)
			return;
		
		logger.verbose('Probing routing table candidate ' + id + ' (' + peer.ap + ')'); 
		var ap = peer.ap.split(':');
		var now = Date.now();
		self.sendHeartbeatToAddr(ap[0], ap[1], {
				routing_table: self.routingtable.getSharedRow(id),
				rsvp_with : now
		});
		peer.lastProbedAt = now;
	})		
};

//
// Run periodically to select a random peer from each routing table row, and send it
// that row from this node's table. See PAS paper for more.
Heartbeater.prototype._initiateRoutingTableMaintenance = function() {
	var self = this;
	self.routingtable.eachRow(function(row, peers) {
		var digits = Object.keys(peers);
		if (digits.length < 1)
			return;
		
		var digitIndex = Math.floor(Math.random() * digits.length);
		var peer = peers[digits[digitIndex]];
		self.routingtable.updateWithProvisional(peer.id, peer.ap, true);
	});
};

exports.Heartbeater = Heartbeater;