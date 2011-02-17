var net = require('net');
var util = require('util');

var self = module.exports = {
	eval : function(f, opts) {
		if (!opts || !opts.success)
			throw new Error('No callback specified for eval remote call');
		
		var port = (opts && opts.port) ? opts.port : 7220;
			
		var client = net.createConnection(port, '127.0.0.1');
		client.addListener("connect", function() {
			client.write('f=' + f);
		});
		client.addListener("data", function(data) {
			var obj;
			try {
				obj = JSON.parse(data);
			} catch (e) {
				util.log('Error parsing eval result data: ' + e);
			}
			
			opts.success(obj);			
			client.end();
		});
		client.addListener("close", function(data) {});
	}
};