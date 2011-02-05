var util = require('util');

var self = module.exports = {
	leafset : {},
	
	//
	// refresh leafset with a known node
	updateLeafset : function(a,b) {
		if (!a)
			return;
		
		var nodes = a;
		if (typeof(a) === 'string') {
			nodes = {};
			nodes[a] = b;
		}
		
		// todo: right now we just put everything into leafset
		for (var id in nodes) {
			if (self.leafset[id]) {
				util.log('Updating node ' + id + ' in leafset');				
			} else {
				util.log('Adding node ' + id + ' to leafset');
			}
			self.leafset[id] = nodes[id];
		}
	}
};