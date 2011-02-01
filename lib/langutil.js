
module.exports = {
	//
	// simple, shallow extend for overriding defaults
	extend : function(a,b) {
		for (var idx in Object.keys(b)) {
			var prop = Object.keys(b)[idx];
			a[prop] = b[prop];
		}
		return a;
	} 
};
