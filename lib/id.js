var uuid = require('node-uuid');
var buffertools = require('buffertools');

module.exports = {
	lengthBits : 160,
	
	generateNodeId : function() {
		var first = uuid().replace(/-/g, '');
		var second= uuid().replace(/-/g, '');
		return (first + second).substring(0,40);
	},
	
	generateUuid : function() {
		return uuid();
	},
	
	getCommonPrefixLength : function(id1, id2) {
		if (id1 === undefined || id2 === undefined)
			return 0;
		
		id1 = id1.toUpperCase();
		id2 = id2.toUpperCase();
		for (var i = 0; i < Math.min(id1.length, id2.length); i++) {
			if (id1.charAt(i) != id2.charAt(i))
				return i;
		}
		return i;
	}
};
