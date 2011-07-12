var logger = require('logmgr').getLogger('overlay/pnsrunner');
var pns = require('overlay/pns');
var node = require('core/node');
var langutil = require('common/langutil');

var self = module.exports = {
	maxPnsAttempts : 3,

	init : function(overlayCallback) {
		pns.init(overlayCallback);
	},
	
	cancelAll : function() {
		pns.cancelAll();
	},
	
	run : function(seed, success) {
		var state = {
			attempt : 0,
			nearest : undefined,
			discovered_peers : [],
			used_seeds : []				
		};
		self._singleRun(seed, state, success);
	},
	
	_singleRun : function(seed, state, success) {
		state.attempt = state.attempt + 1;
		logger.verbose('Starting PNS run from seed ' + seed + ' with state ' + JSON.stringify(state));		
		state.used_seeds.push(seed);		
		
		pns.findNearestNode(seed, node.nodeId, function(res) {
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
	},
	
	_addDiscoveredPeers : function(state, discoveredPeers) {
		if (discoveredPeers === undefined)
			return;
		state.used_seeds.forEach(function(peer) {
			langutil.arrRemoveItem(discoveredPeers, peer);
		});
		discoveredPeers.forEach(function(peer) {
			if (state.discovered_peers.indexOf(peer) < 0)
				state.discovered_peers.push(peer);			
		});
	}	
};