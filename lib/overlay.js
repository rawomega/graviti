if (global.GENTLY) require = GENTLY.hijack(require);
var node = require('./node');

//
// Manages overlay membership
module.exports = {
	bootstrapping : false,
	bootstrappingIntervalId : undefined,
	defaultPort : 4728,
	bootstrapRetryIntervalMsec : 5000,
	leafset : [],
	routingtable : [],
	bootstrapEndpoints : [],

	init : function(port, bindAddr) {
		node.start(port, bindAddr);
	},
	
	join : function(port, bindAddr, bootstraps) {
		if (!bootstraps || bootstraps.length < 1)
			throw new Error('Invalid or missing bootstrap list ' + bootstraps);		
		
		for (var addrStr in bootstraps.replace(/\s/g, '').split(',')) {
			var endpointPort = this.defaultPort;
			var parts = addrStr.split(':');
			var endpointAddr = parts[0];
			if (parts > 1)
				endpointPort = parts[1];
			
			this.bootstrapEndpoints[endpointAddr + ':' + endpointPort] = {
				last_attempt_at : 	undefined,
				last_response_at : 	undefined
			};
		}
				
		node.start(port, bindAddr);
		
		this._startBootstrapping();
	},
	
	_startBootstrapping : function() {
		this.bootstrapping = true;
		
		var _this = this;
		this.bootstrappingIntervalId = setInterval (function() {
			if (!_this.bootstrapping)
				return;
			
			for (var endpoint in this.bootstrapEndpoints) {						
				var endpointData = _this.bootstrapEndpoints[endpoint];
				var now = new Date().getTime();
				if (endpointData && endpointData.last_attempt_at < (now - _this.bootstrapRetryIntervalMsec)) {
					console.log('sending bootstrap req to ' + endpoint);
					node.send();
					endpointData.last_attempt_at = now;
				}
			}			
		}, 1000);
	},
	
	leave : function() {
		if (this.bootstrappingIntervalId)
			clearInterval(this.bootstrappingIntervalId);
		
		// todo: send parting message
		
		node.stop();
	}
};
