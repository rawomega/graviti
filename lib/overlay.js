if (global.GENTLY) require = GENTLY.hijack(require);
var node = require('./node');

//
// Manages overlay membership
module.exports = {
	leafset : [],
	routingtable : [],
	bootstrapping: false,
	bootstrapaddrs : [],

	init : function(port, address) {
		node.start(port, address);
	},
	
	join : function(port, address, bootstraps) {
		if (!bootstraps || bootstraps.length < 1)
			throw new Error('Invalid or missing bootstrap list ' + bootstraps);
	
		this.boostrapaddrs = bootstraps.replace(/\s/g, '').split(',');
		
		node.start(port, address);
	
		for (var addr in this.bootstrapaddrs) {
			// todo: impl
			console.log('bootstrap');
		}
	},
	
	leave : function() {
		// todo: send parting message
		
		node.stop();
	}
};
