var assert = require('assert');
var mod_id = require('id');

module.exports = {
	shouldGenerateUuid : function() {
		var res = mod_id.generateUuid();

		assert.length(res.replace(/-/g, ''), 32);
		assert.length(res.replace(/[^-]/g, ''), 4);
	},
	shouldGenerateNodeId : function() {
		var res = mod_id.generateNodeId();

		assert.length(res, 40);
	}
};
