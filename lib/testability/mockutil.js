exports.stubProto = function(obj, state) {
	if (obj.prototype === undefined)
			throw new Error('Can\'t stub obj with no prototype');

	var res = state || {};	
	Object.keys(obj.prototype).forEach(function(key) {		
		if (typeof(obj.prototype[key]) === 'function') {
			res[key] = function() {};
		}
	});
	
	if (obj.super_ === undefined)
		return res;
	else		
		return exports.stubProto(obj.super_, res);
};