var assert = require('assert');
var mod_id = require('../lib/id');
var testCase = require('nodeunit').testCase;

module.exports = {
	"id generation" : testCase({		
		"should generate uuid" : function(test) {
			var res = mod_id.generateUuid();
	
			test.ok(res.replace(/-/g, '').length === 32);
			test.ok(res.replace(/[^-]/g, '').length === 4);			
			test.done();
		},
		
		"should generate node id" : function(test) {
			var res = mod_id.generateNodeId();

			test.ok(res.length === 40);			
			test.done();
		}
	})
};
