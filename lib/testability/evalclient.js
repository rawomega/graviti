var net = require('net');
var winston = require('winston');

var self = module.exports = {
	eval : function(f, opts) {
		if (!f)
			throw new Error('Undefined function given to eval');
		if (!opts || !opts.success)
			throw new Error('No callback specified for eval remote call');
		
		var port = (opts && opts.port !== undefined) ? opts.port : 7220;
		var client = net.createConnection(port, '127.0.0.1');
		client.addListener("error", function(e) {
			winston.verbose('test client error: ' + e);
			if (opts.error)
				opts.error(e);
		});
		client.addListener("connect", function() {
			client.write('f=' + f);
		});
		client.addListener("data", function(data) {
			client.end();
			var obj;
			try {
				obj = JSON.parse(data);
			} catch (e) {				
				winston.error('Error parsing eval result data, perhaps due to packet fragmentation? ' + e);
				if (opts.error)
					opts.error(e);
				return;
			}
			
			if (obj.error && opts.error)
				opts.error(obj.error);
			else
				opts.success(obj);	
		});
		client.addListener("close", function() {
			//winston.verbose('test client connection closed');
		});
	}
};