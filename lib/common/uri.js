var crypto = require('crypto');

module.exports.parse = function(uri) {
	if (uri.indexOf('p2p:') !== 0)
		throw new Error('Invalid or missing uri scheme: ' + uri);
	var parts = uri.split('/');
	if (parts.length < 2)
		throw new Error('Missing resource (/...) in uri ' + uri);
	var scheme = parts[0].substring(0, parts[0].indexOf(':'));
	var appName = parts[0].substring(1+parts[0].indexOf(':'));
	if (appName.length < 1)
		throw new Error('Missing id in uri ' + uri);
	
	var resource = uri.substring(uri.indexOf('/'));
	var hash = crypto.createHash('sha1').update(resource).digest('hex').toUpperCase();
	return {
		scheme: scheme,
		app_name: appName.toLowerCase(),
		resource: resource.toLowerCase(),
		hash: hash
	};
};