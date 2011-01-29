var mod_node = require('./node');

//
// Manages overlay membership
module.exports = {
	leafset : [],
	routingtable : [],
	bootstrapping: false,
	bootstrapaddrs : [],

	join : function(bootstraps) {
		// start node
	
		boostrapaddrs = bootstraps.replace(/\s/g, '').split(',');
		for (var addr in bootstrapaddrs) {
			// todo: impl
			console.log('bootstrap');
		} 
	},
	
	leave : function() {
		// send parting message
		
		// stop node
	}
};
