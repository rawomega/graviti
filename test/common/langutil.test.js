var langutil = require('../../lib/common/langutil');
var assert = require('assert');
var testCase = require('nodeunit').testCase;

module.exports = {
	"extending an object" : testCase ({
		
		"should extend empty with undefined" : function(test) {
			test.deepEqual({}, langutil.extend({}, undefined));
			test.done();
		},
		
		"should extend empty with empty" : function(test) {
			test.deepEqual({}, langutil.extend({}, {}));
			test.done();
		},
	
		"should extend empty with something" : function(test) {
			test.deepEqual({a:'b'}, langutil.extend({}, {a:'b'}));
			test.done();
		},
		
		"should extend orthogonal" : function(test) {
			test.deepEqual({a:"b", c:"d"}, langutil.extend({a:"b"}, {c:"d"}));
			test.done();
		},
		
		"should override existing value" : function(test) {
			test.deepEqual({a:"z", b:"y"}, langutil.extend({a:"x", b:"y"}, {a:"z"}));
			test.done();
		},
		
		"should override existing object" : function(test) {
			test.deepEqual(
					{a: {nested: true}, b:"c", x:"y"},
					langutil.extend(
							{a:{nested:false, somethingelse : true}, b:"c"},
							{a:{nested:true}, x:"y"}
					)
			);
			test.done();
		},
	}),
	
	"testing arrays" : testCase({
		
		"should be able to tell that empty object is not an array" : function(test) {
			test.strictEqual(false, langutil.isArray({}));
			test.done();
		},
		
		"should be able to tell that  undefined object is not an array" : function(test) {
			test.strictEqual(false, langutil.isArray(undefined));
			test.done();
		},
		
		"should be able to tell that simple object is not an array" : function(test) {
			test.strictEqual(false, langutil.isArray({a:'b'}));
			test.done();
		},
		
		"should be able to tell that string is not an array": function(test) {
			test.strictEqual(false, langutil.isArray('str'));
			test.done();
		},
		
		"should be able to tell that empty array is an array" : function(test) {
			test.strictEqual(true, langutil.isArray([]));
			test.done();
		},
		
		"should be able to tell that non empty array is an array" : function(test) {
			test.strictEqual(true, langutil.isArray([1,2,3]));
			test.done();
		}
	})
};
