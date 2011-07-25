var assert = require('assert');
var langutil = require('langutil');
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
		
		"should retain function" : function(test) {
			var res = langutil.extend(
					{a:"b", f: function(){return 3;}},
					{c:"d"}
			);
			
			test.equal(3, res.f());
			test.done();
		},
		
		"should replace function" : function(test) {
			var res = langutil.extend(
					{a:"b", f: function(){return 3;}},
					{c:"d", f: function(){return 4;}}
			);
			
			test.equal(4, res.f());
			test.done();
		},
		
		"should add function" : function(test) {
			var res = langutil.extend(
					{a:"b"},
					{c:"d", f: function(){return 5;}}
			);
			
			test.equal(5, res.f());
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
	}),
	
	"array removal operations" : testCase({
		"should remove item from array by index" : function(test) {
			var a = ['a', 'b', 'c'];
			
			langutil.arrRemove(a, 1);
			
			test.deepEqual(['a', 'c'], a);
			test.done();
		},
		
		"should remove item from array by index for numeric values" : function(test) {
			var a = [1, 2, 3];
			
			langutil.arrRemove(a, 1);
			
			test.deepEqual([1, 3], a);
			test.done();
		},
		
		"should remove item from array by value" : function(test) {
			var a = ['a', 'b', 'c'];
			
			langutil.arrRemoveItem(a, 'b');
			
			test.deepEqual(['a', 'c'], a);
			test.done();
		},
		
		"should remove multiple copies of an item from array by value" : function(test) {
			var a = ['a', 'b', 'b', 'c', 'b'];
			
			langutil.arrRemoveItem(a, 'b');
			
			test.deepEqual(['a', 'c'], a);
			test.done();
		},
		
		"should remove item from array by value for numeric values" : function(test) {
			var a = [1, 2, 3];
			
			langutil.arrRemoveItem(a, 1);
			
			test.deepEqual([2, 3], a);
			test.done();
		},
	})
};
