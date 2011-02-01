if (global.GENTLY) require = GENTLY.hijack(require);
var node = require('./node');
var id = require('./id');
var util = require('util');
var uri = require('./uri');
var langutil = require('./langutil');

//
// Manages overlay membership
module.exports = {
	bootstrapping : false,
	bootstrappingIntervalId : undefined,
	defaultPort : 4728,
	bootstrapRetryIntervalMsec : 5000,
	leafset : {},
	routingtable : {},
	bootstrapEndpoints : {},

	init : function(port, bindAddr) {
		this._startNode(port, bindAddr);
	},
	
	join : function(port, bindAddr, bootstraps) {
		if (!bootstraps || bootstraps.length < 1)
			throw new Error('Invalid or missing bootstrap list ' + bootstraps);		
		
		util.log('Going to join overlay through bootstraps ' + bootstraps);
		var bootstrapParts = bootstraps.replace(/\s/g, '').split(',');
		for (var i = 0; i < bootstrapParts.length; i++) {			
			var endpointPort = this.defaultPort;
			var parts = bootstrapParts[i].split(':');
			var endpointAddr = parts[0];
			if (parts.length > 1)
				endpointPort = parts[1];
			
			this.bootstrapEndpoints[endpointAddr + ':' + endpointPort] = {
				last_attempt_at : 	0,
				last_response_at : 	0
			};
		}
				
		this._startNode(port, bindAddr);
		this._startBootstrapping();
	},
	
	_startNode : function(port, bindAddr) {
		node.on("message", function(msg) {
			var parsedUri = uri.parse(msg.uri);
			if (parsedUri.app_name === 'graviti'	&& parsedUri.resource.indexOf('/bootstraptarget') === 0) {
				util.log('Bootstrap message');
				//node.send(msg);
			}
		});
		node.start(port, bindAddr);
	},
	
	//
	// initiate a function (via setInterval) to check for any pending bootstrap messages and send them
	_startBootstrapping : function() {
		this.bootstrapping = true;
		util.log(JSON.stringify(this.bootstrapEndpoints));
		var _this = this;
		this.bootstrappingIntervalId = setInterval (function() {
			if (!_this.bootstrapping)
				return;

			for (var endpoint in _this.bootstrapEndpoints) {						
				var endpointData = _this.bootstrapEndpoints[endpoint];				
				var now = new Date().getTime();
				if (endpointData && endpointData.last_attempt_at < (now - _this.bootstrapRetryIntervalMsec)) {
					util.log('Sending bootstrap req to ' + endpoint);
					var endpointParts = endpoint.split(':');
					_this._send(endpointParts[0], endpointParts[1], undefined, {
						uri : 'p2p:graviti/bootstraptarget'
					});
					endpointData.last_attempt_at = now;
				}
			}			
		}, 1000);
	},
	
	//
	// single message send to a uri
	send : function(destUri, content, headers) {
		// map id to ip + port
		var parsedUri = uri.parse(destUri);
		var mapped = mapIdToNode();
		
		var defaultHeaders = {
			dest_id : parsedUri.hash,
			uri : destUri
		};
		
		this._send(mapped.addr, mapped.port, content, langutil.extend(defaultHeaders, headers));
	},
	
	// 
	// single message send to a known ip + port
	_send : function(addr, port, content, headers) {
		var msg = {
			msg_id : id.generateUuid(),
			source_id : node.nodeId,
			created : new Date().getTime(),
			method : 'GET',			
			content : content
			// todo: correlation, transaction ids
		};
		var msgWithHeaders = langutil.extend(msg, headers);
		
		node.send(addr, port, msgWithHeaders);
	},	
	
	leave : function() {
		if (this.bootstrappingIntervalId)
			clearInterval(this.bootstrappingIntervalId);
		
		// todo: send parting message
		
		node.stop();
	}
};