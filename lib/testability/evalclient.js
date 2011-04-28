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
			// lets kill off this socket after a little while as we may have got stuck waiting to parse or something
			if (client.timeoutId === undefined)
				client.timeoutId = setTimeout(function() {
					winston.error('Closing hanging client connection - prob stuck on bad data: ' + client.inProgress);
					client.inProgress = undefined;
					client.end();
					if (opts.error)
						opts.error('Forcibly terminated hanging evalclient connection');
				}, 3000);
			
			var raw = data;
			if (client.inProgress)
				raw = client.inProgress + raw;
		
			var obj;
			try {
				obj = JSON.parse(data);
			} catch (e) {
				winston.info('Looks like packet frag: ' + raw);
				client.inProgress = raw;
				return;
			}	

			client.inProgress = undefined;			
			client.end();	
			clearTimeout(client.timeoutId);
			
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