var self = module.exports = {
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
	},
	
	// remove given item from array
	arrRemove : function(array, from, to) {
		var rest = array.slice((to || from) + 1 || array.length);
		array.length = from < 0 ? array.length + from : from;
		return array.push.apply(array, rest);
	},
	
	arrRemoveItem : function(arr, item) {
		if (item === undefined || arr.indexOf(item) < 0)
			return;
		while (arr.indexOf(item) > -1)
			self.arrRemove(arr, arr.indexOf(item));
		return arr.length;
	}
};
