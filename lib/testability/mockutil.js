module.exports.stubProto = function(obj) {
	if (obj.prototype === undefined)
			throw new Error('Can\'t stub obj with no prototype');

	var res = {};
	Object.keys(obj.prototype).forEach(function(key) {
		if (typeof(obj.prototype[key]) === 'function') {
			res[key] = function() {};
		}
	});
	return res;
};