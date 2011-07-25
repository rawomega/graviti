//
// Implements the main algorithm from the PNS-CG paper. Given a
// known 'seed' node for bootstrapping, this algorithm will locate
// the closest node (in latency terms) to a node joining the ring.
//
var logger = require('logmgr').getLogger('pastry/pns');
var id = require('common/id');
var node = require('core/node');
var langutil = require('common/langutil');

exports.maxPnsAttempts = 3;

exports.run = function(transport, leafset, routingtable, seed, success) {
	var pns = new Pns(transport, leafset, routingtable);
	pns.run(seed, success);
	return pns;
};

Pns = function(transport, leafset, routingtable) {
	var self = this;
	self.nearestNodeSearchTimeoutMsec = 20000;
	self.rttWhenInsufficientPeers = 10000;
	self.maxRoutingTableDepth = 10;
	self.transport = transport;
	self.leafset = leafset;
	self.routingtable = routingtable;
	self._inProgress = {};	
	self.transport.on('graviti-message-received', function(msg, msginfo) {			
		if (msg.method === 'GET') {				
			if (/\/pns\/leafset/.test(msg.uri)) {
				self._handlePnsLeafsetRequest(msg, msginfo);
			} else if (/\/pns\/routingrow/.test(msg.uri)) {
				self._handlePnsRoutingRowRequest(msg, msginfo);
			} else if (/\/pns\/rttprobe/.test(msg.uri)) {
				self._handleRttProbeRequest(msg, msginfo);
			}
		} else if (msg.method === 'POST') {				
			if (/\/pns\/leafset/.test(msg.uri)) {
				self._handlePnsLeafsetResponse(msg, msginfo);
			} else if (/\/pns\/routingrow/.test(msg.uri)) {
				self._handlePnsRoutingRowResponse(msg, msginfo);
			} else if (/\/pns\/rttprobe/.test(msg.uri)) {
				self._handleRttProbeResponse(msg, msginfo);
			}
		}
	});
};
exports.Pns = Pns;

Pns.prototype.run = function(seed, success) {
	var state = {
		attempt : 0,
		nearest : undefined,
		discovered_peers : [],
		used_seeds : []				
	};
	this._singleRun(seed, state, success);
};
	
Pns.prototype._singleRun = function(seed, state, success) {
	var self = this;
	state.attempt = state.attempt + 1;
	logger.verbose('Starting PNS run from seed ' + seed + ' with state ' + JSON.stringify(state));		
	state.used_seeds.push(seed);		
		
	self.findNearestNode(seed, node.nodeId, function(res) {
		logger.verbose('PNS via seed ' + seed + ' gave nearest node ' + JSON.stringify(res));
	
		if (state.nearest === undefined || state.nearest.rtt > res.rtt) {
			logger.verbose('PNS found new nearest node ' + res.ap + ' with rtt ' + res.rtt + ', replacing ' + JSON.stringify(state.nearest));
			state.nearest = {
				id : res.id,
				ap : res.ap,
				rtt : res.rtt
			};
		}
			
		// add public ip for bootstrap to list of used bootstraps
		if (res.public_seed_ap && state.used_seeds.indexOf(res.public_seed_ap) < 0)
			state.used_seeds.push(res.public_seed_ap);
		
		self._addDiscoveredPeers(state, res.discovered_peers);
		
		var numDiscoveredPeers = state.discovered_peers.length;
		if (numDiscoveredPeers < 1 || state.attempt >= self.maxPnsAttempts) {
			success(state.nearest.ap);
		} else {
			// pick random peer from discovered nodes and repeat
			var newSeed = state.discovered_peers[Math.floor(Math.random()*numDiscoveredPeers)];
			langutil.arrRemoveItem(state.discovered_peers, newSeed);
			self._singleRun(newSeed, state, success);
		}
	});
};

Pns.prototype._addDiscoveredPeers = function(state, discoveredPeers) {
	if (discoveredPeers === undefined)
		return;
	state.used_seeds.forEach(function(peer) {
		langutil.arrRemoveItem(discoveredPeers, peer);
	});
	discoveredPeers.forEach(function(peer) {
		if (state.discovered_peers.indexOf(peer) < 0)
			state.discovered_peers.push(peer);			
	});
};

//
// Initiates search for a nearby node to 'bootstrap' off of. Result is delivered as a callback to
// the success function. If no result is receivd within the given time window, the process ends
// and the timeout notification is delivered via error.
Pns.prototype.findNearestNode = function(seedNodeAp, joiningNodeId, success, error) {
	var self = this;
	var reqId = id.generateUuid();
	var ap = seedNodeAp.split(':');
	self._inProgress[reqId] = {
			addr : ap[0],
			port : ap[1],
			depth : self.maxRoutingTableDepth,
			joiningNodeId : joiningNodeId,
			routing_row_probes : {},
			nearest : {},
			originalSeedAp : seedNodeAp,
			publicSeedAp : undefined,
			discoveredPeers : [],	// we keep track of these so the caller
									// can repeat the find process by starting
									// at a different random node; this reduces
									// risk of getting stuck in local minima (see paper)
			success : success,
			error : error
	};
	
	self.transport.sendToAddr('p2p:graviti/pns/leafset', {req_id : reqId},
			{method : 'GET'}, ap[0], ap[1]);
	
	self._inProgress[reqId].timerId = setTimeout(function() {
		logger.info('Bootstrap timed out whilst trying to locate nearest node via seed ' + seedNodeAp);
		delete self._inProgress[reqId];
		if (error)
			error();
	}, self.nearestNodeSearchTimeoutMsec);
	
	return reqId;
};

//
// Forget about all ongoing PNS nearby node searches by throwing away state. The error callback
// function is not called.
Pns.prototype.cancelAll = function() {
	var self = this;
	if (Object.keys(self._inProgress).length > 0)
		logger.info('Cancelling all existing PNS requests');
	Object.keys(self._inProgress).forEach(function(reqId) {
		clearTimeout(self._inProgress[reqId].timerId);
	});
	self._inProgress = {};
};

Pns.prototype._handlePnsLeafsetRequest = function(msg, msginfo) {
	logger.verbose('PNS bootstrap request for leafset received');
	var reqId = msg.content.req_id;
	var ap = msginfo.source_ap.split(':');
	this.transport.sendToAddr('p2p:graviti/pns/leafset', {
			req_id : reqId,
			leafset : this.leafset.compressedLeafset()
		}, {method : 'POST'}, ap[0], ap[1]);
};

Pns.prototype._handlePnsLeafsetResponse = function(msg, msginfo) {
	logger.verbose('PNS bootstrap response with leafset received');
	var reqId = msg.content.req_id;
	var req = this._inProgress[reqId];
	if (!req)
		return;
	
	// the source ip of the response is the seed's public ip
	req.publicSeedAp = msginfo.source_ap;
	
	// if joining node in leafset (perhaps it went down and back up quickly), get rid of it
	delete msg.content.leafset[req.joiningNodeId];
	
	if (msg.content.leafset === undefined || Object.keys(msg.content.leafset).length < 1) {
		this._reportSuccess(reqId, msg.source_id, msginfo.source_ap, this.rttWhenInsufficientPeers);
		return;
	}
	
	this._sendLeafsetProbes(reqId, msg.content.leafset);
};

Pns.prototype._sendLeafsetProbes = function(reqId, leafset) {
	var self = this;
	var req = self._inProgress[reqId];
	req.leafset_probes = {};
	Object.keys(leafset).forEach(function(nodeId) {
		self._rememberDiscoveredPeer(req, leafset[nodeId]);
		
		req.leafset_probes[nodeId] = Date.now();
		var ap = leafset[nodeId].split(':');
		self.transport.sendToAddr('p2p:graviti/pns/rttprobe', {
			req_id : reqId
		}, {method : 'GET'}, ap[0], ap[1]);
	});
};

Pns.prototype._handlePnsRoutingRowRequest = function(msg, msginfo) {
	logger.verbose('PNS routing row request received');
	var reqId = msg.content.req_id;
	var depth = msg.content.depth;
	var ap = msginfo.source_ap.split(':');
	var bestDepth = 0;
	var bestRow = {};
	
	if (depth !== undefined) {
		this.routingtable.eachRow(function(rowIndex, row) {
			if (rowIndex > depth || rowIndex < bestDepth)
				return;
			
			if (Object.keys(row).length > 0) {
				bestDepth = rowIndex;
				bestRow = row;
			}
		});			
	}
	this.transport.sendToAddr('p2p:graviti/pns/routingrow', {
			req_id : reqId,
			depth : bestDepth,
			routing_row : bestRow
		}, {method : 'POST'}, ap[0], ap[1]);
};

Pns.prototype._handlePnsRoutingRowResponse = function(msg, msginfo) {
	logger.verbose('PNS routing row response received');		
	var reqId = msg.content.req_id;
	var req = this._inProgress[reqId];
	if (req === undefined)
		return;

	req.depth = msg.content.depth === 0 ? 0 : msg.content.depth - 1;

	// if joining node in routing row (perhaps it was up previously), get rid of it
	if (msg.content.routing_row !== undefined) {
		Object.keys(msg.content.routing_row).forEach(function(dgt) {
			if (msg.content.routing_row[dgt].id === req.joiningNodeId)
				delete msg.content.routing_row[dgt];
		});
	}

	if (msg.content.routing_row === undefined || Object.keys(msg.content.routing_row).length < 1) {
		this._reportSuccess(reqId, req.nearest.id, req.nearest.ap, this.rttWhenInsufficientPeers);
		return;
	}
	
	this._sendRoutingRowProbes(reqId, msg.content.routing_row);
};

Pns.prototype._handleRttProbeRequest = function(msg, msginfo) {
	logger.verbose('PNS RTT probe request received');
	var reqId = msg.content.req_id;
	var ap = msginfo.source_ap.split(':');
	var content = {	req_id : reqId };
	if (msg.content.probe_id !== undefined)
		content.probe_id = msg.content.probe_id;
	this.transport.sendToAddr('p2p:graviti/pns/rttprobe', content, {method : 'POST'}, ap[0], ap[1]);
};

Pns.prototype._handleRttProbeResponse = function(msg, msginfo) {
	logger.verbose('PNS RTT probe response received');
	var reqId = msg.content.req_id;
	var req = this._inProgress[reqId];
	if (req === undefined)
		return;
	
	var probeSent;
	var probeId = msg.content.probe_id;
	if (probeId) {
		if (!req.routing_row_probes[probeId])
			return;
		probeSent = req.routing_row_probes[probeId][msg.source_id];
		if (!probeSent)
			return;
		delete req.routing_row_probes[probeId];
	} else {
		if (req.leafset_probes === undefined)
			return;			
		probeSent = req.leafset_probes[msg.source_id];
		if (!probeSent)
			return;
		delete req.leafset_probes;
	}
	
	var rtt = Date.now() - probeSent;
	var nearest = req.nearest;
	if (nearest.rtt !== undefined && nearest.rtt <= rtt) {
		this._reportSuccess(reqId, nearest.id, nearest.ap, nearest.rtt);
		return;
	}
	
	nearest.id = msg.source_id;
	nearest.ap = msginfo.source_ap;
	nearest.rtt = rtt;
	
	this._sendRoutingRowRequest(reqId, msginfo.source_ap, req.depth);
};

Pns.prototype._sendRoutingRowRequest = function(reqId, addrPort, depth) {
	var ap = addrPort.split(':');
	this.transport.sendToAddr('p2p:graviti/pns/routingrow', {
			req_id : reqId,
			depth : depth
		}, {method : 'GET'}, ap[0], ap[1]);
};

Pns.prototype._sendRoutingRowProbes = function(reqId, row) {
	var self = this;
	var req = self._inProgress[reqId];
	var probeId = id.generateUuid();
	req.routing_row_probes[probeId] = {};
	Object.keys(row).forEach(function(prefix) {
		var peer = row[prefix];
		req.routing_row_probes[probeId][peer.id] = Date.now();
		self._rememberDiscoveredPeer(req, peer.ap);
		
		var ap = peer.ap.split(':');
		self.transport.sendToAddr('p2p:graviti/pns/rttprobe', {
			req_id : reqId,
			probe_id : probeId
		}, {method : 'GET'}, ap[0], ap[1]);
	});
};

Pns.prototype._rememberDiscoveredPeer = function(req, ap) {
	if (ap !== req.originalSeedAp && ap !== req.publicSeedAp && req.discoveredPeers.indexOf(ap) < 0)
		req.discoveredPeers.push(ap);
};

Pns.prototype._reportSuccess = function(reqId, bestId, bestAp, bestRtt) {
	var req = this._inProgress[reqId];		
	if (!req)
		return;
	var success = req.success;
	var publicSeedAp = req.publicSeedAp;
	var discoveredPeers = req.discoveredPeers;
	clearTimeout(req.timerId);
	
	delete this._inProgress[reqId];

	logger.verbose('PNS nearby node search completed for seed ' + req.originalSeedAp + ' - returning node ' + bestId + ' (' + bestAp + '), rtt=' + bestRtt);
	if (success)
		success({
			id : bestId,
			ap : bestAp,
			rtt : bestRtt,
			discovered_peers : discoveredPeers,
			public_seed_ap : publicSeedAp
		});
};