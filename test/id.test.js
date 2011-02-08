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
	}),
	
	"id digit differences" : testCase({
		"detect first differing digit between two different ids" : function(test) {
			var res = id.getFirstDifferentDigit('abc', 'bcc');
			
			test.equal(0, res);
			test.done();
		},		
		
		"detect first differing digit between two different ids, ignoring casing" : function(test) {
			var res = id.getFirstDifferentDigit('abc', 'ABD');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect first differing digit between two different ids where one is longer" : function(test) {
			var res = id.getFirstDifferentDigit('abc', 'abde');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect first differing digit between two identical ids" : function(test) {
			var res = id.getFirstDifferentDigit('abc', 'ABC');
			
			test.equal(-1, res);
			test.done();
		},
		
		"detect first differing digit between two ids where one is the prefix of another" : function(test) {
			var res = id.getFirstDifferentDigit('abc', 'ABCde');
			
			test.equal(3, res);
			test.done();
		},
		

		"detect first differing digit between two different ids where one is empty" : function(test) {
			var res = id.getFirstDifferentDigit('abc', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect first differing digit between two different ids where both are empty" : function(test) {
			var res = id.getFirstDifferentDigit('', '');
			
			test.equal(-1, res);
			test.done();
		},
		
		"detect first differing digit between two different ids where one is undefined" : function(test) {
			var res = id.getFirstDifferentDigit('abc', undefined);
			
			test.equal(-1, res);
			test.done();
		}
	})
};
