var assert = require('assert');
var id = require('../lib/id');
var testCase = require('nodeunit').testCase;

module.exports = {
	"id generation" : testCase({
		"default id length should be 160 bits" : function(test) {
			assert.strictEqual(160, id.lengthBits);
			test.done();
		},
		
		"should generate uuid" : function(test) {
			var res = id.generateUuid();
	
			test.ok(res.replace(/-/g, '').length === 32);
			test.ok(res.replace(/[^-]/g, '').length === 4);			
			test.done();
		},
		
		"should generate node id" : function(test) {
			var res = id.generateNodeId();

			test.ok(res.length === 40);			
			test.done();
		}
	})
};
