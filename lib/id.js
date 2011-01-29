var uuid = require('node-uuid');
var buffertools = require('buffertools');

module.exports = {
	generateNodeId : function() {
		var first = uuid().replace(/-/g, '');
		var second= uuid().replace(/-/g, '');
		return (first + second).substring(0,40);
	},
	generateUuid : function() {
		return uuid();
	}
};
