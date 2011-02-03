var langutil = require('langutil');
var assert = require('assert');

module.exports = {
	shouldExtendEmptyWithUndefined : function() {
		assert.eql({}, langutil.extend({}, undefined));
	},
	
	shouldExtendEmptyWithEmpty : function() {
		assert.eql({}, langutil.extend({}, {}));
	},

	shouldExtendEmptyWithSomething : function() {
		assert.eql({a:'b'}, langutil.extend({}, {a:'b'}));
	},
	
	shouldExtendOrthogonal : function() {
		assert.eql({a:"b", c:"d"}, langutil.extend({a:"b"}, {c:"d"}));
	},
	
	shouldOverrideExistingValue : function() {
		assert.eql({a:"z", b:"y"}, langutil.extend({a:"x", b:"y"}, {a:"z"}));
	},
	
	shouldOverrideExistingObject : function() {
		assert.eql(
				{a: {nested: true}, b:"c", x:"y"},
				langutil.extend(
						{a:{nested:false, somethingelse : true}, b:"c"},
						{a:{nested:true}, x:"y"}
				)
		);
	}
};
