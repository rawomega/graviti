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
	
    "testing for arrays" : testCase({
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
    }),

    "array priority queue" : testCase({
        "should insert element into empty pq" : function(test) {
            var pq = [];
            var el = { a : 1 };

            langutil.pqInsert(pq, el, 'a');

            test.deepEqual(el, pq.shift());
            test.equal(0, pq.length);
            test.done();
        },

        "should insert element into non-empty pq in key order in middle" : function(test) {
            var pq = [{a : 0}, {a : 2}];
            var el = { a : 1 };

            langutil.pqInsert(pq, el, 'a');

            test.deepEqual(el, pq[1]);
            test.equal(3, pq.length);
            test.done();
        },

        "should insert element into non-empty pq in key order at beginning" : function(test) {
            var pq = [{a : 3}, {a : 7}];
            var el = { a : 2 };

            langutil.pqInsert(pq, el, 'a');

            test.deepEqual(el, pq[0]);
            test.equal(3, pq.length);
            test.done();
        },

        "should insert element into non-empty pq in key order at end" : function(test) {
            var pq = [{a : 0}, {a : 2}];
            var el = { a : 5 };

            langutil.pqInsert(pq, el, 'a');

            test.deepEqual(el, pq[2]);
            test.equal(3, pq.length);
            test.done();
        },

        "should reject element that does not contain specified key" : function(test) {
            var el = { a : 1 };

            assert.throws(function() {
                langutil.pqInsert([], el, 'b');
            }, /does not contain key b/i);            
            test.done();
        },

        "should throw if one or more existing elements do not contain required key" : function(test) {
            var pq = [ {a : 0}, {b : 3}]
            var el = { a : 1 };

            assert.throws(function() {
                langutil.pqInsert(pq, el, 'a');
            }, /do not contain key a/i);
            test.done();
        },
	})
};