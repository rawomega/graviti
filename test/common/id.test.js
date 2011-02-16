var assert = require('assert');
var id = require('common/id');
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
	
	"common id prefix calcluation" : testCase({
		"detect that there is no common prefix in two different ids" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'bcc');
			
			test.equal(0, res);
			test.done();
		},		
		
		"detect common prefix from two different ids, ignoring casing" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'ABD');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect common prefix between two different ids where one is longer" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'abde');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect common prefix between two identical ids" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'ABC');
			
			test.equal(3, res);
			test.done();
		},
		
		"detect common prefix for two ids where one is the prefix of another" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'ABCde');
			
			test.equal(3, res);
			test.done();
		},
		

		"detect common prefix for two different ids where one is empty" : function(test) {
			var res = id.getCommonPrefixLength('abc', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect common prefix for two different ids where both are empty" : function(test) {
			var res = id.getCommonPrefixLength('', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect common prefix for two different ids where one is undefined" : function(test) {
			var res = id.getCommonPrefixLength('abc', undefined);
			
			test.equal(0, res);
			test.done();
		}
	})
};
