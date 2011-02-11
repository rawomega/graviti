
module.exports = {
	//
	// simple, shallow extend for overriding defaults
	extend : function(a,b) {
		if (b === undefined)
			return a;
	
		for (var idx in Object.keys(b)) {
			var prop = Object.keys(b)[idx];
			a[prop] = b[prop];
		}
		return a;
	},
	
	//
	// test if a given obj is an array
	isArray : function(obj) {
		return Object.prototype.toString.call(obj) == '[object Array]';
	}
};
