var logger = require('logmgr').getLogger('overlay/pastry/pnsrunner');
var node = require('core/node');
var langutil = require('common/langutil');

exports.maxPnsAttempts = 3;

PnsRunner = function(pns) {
	this.pns = pns;
};

PnsRunner.prototype.cancelAll = function() {
	this.pns.cancelAll();
};
	
PnsRunner.prototype.run = function(seed, success) {
	var state = {
		attempt : 0,
		nearest : undefined,
		discovered_peers : [],
		used_seeds : []				
	};
	this._singleRun(seed, state, success);
};
	
PnsRunner.prototype._singleRun = function(seed, state, success) {
	var self = this;
	state.attempt = state.attempt + 1;
	logger.verbose('Starting PNS run from seed ' + seed + ' with state ' + JSON.stringify(state));		
	state.used_seeds.push(seed);		
		
	self.pns.findNearestNode(seed, node.nodeId, function(res) {
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
	
PnsRunner.prototype._addDiscoveredPeers = function(state, discoveredPeers) {
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

exports.PnsRunner = PnsRunner;