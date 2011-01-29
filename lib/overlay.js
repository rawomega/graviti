var mod_node = require('./node');

module.exports = {
	leafset : [],
	routingtable : [],
	bootstrapping: false,
	bootstrapaddrs : [],

	join : function(bootstraps) {
		boostrapaddrs = bootstraps.replace(/\s/g, '').split(',');
		for (var addr in bootstrapaddrs) {
			// todo: impl
			console.log('bootstrap');
		} 
	}
};
