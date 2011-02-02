if (global.GENTLY) require = GENTLY.hijack(require);
var node = require('./node');
var id = require('./id');
var util = require('util');
var uri = require('./uri');
var langutil = require('./langutil');

//
// Manages overlay membership
module.exports = langutil.extend(new events.EventEmitter(), {
	bootstrapping : false,
	bootstrappingIntervalId : undefined,
	defaultPort : 4728,
	bootstrapRetryIntervalMsec : 5000,
	leafset : {},
	routingtable : {},
	bootstrapEndpoints : {},

	//
	// Initialise ourselves as the first node in a ring
	init : function(port, bindAddr) {
		this._startNode(port, bindAddr);
	},
	
	//
	// Join an existing ring via specified bootstraps
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
		var _this = this;
		node.on("message", function(msg) {
			_this._handleReceived(msg);
		});
		node.start(port, bindAddr);
	},
	
	_handleReceived : function(msg) {
		// figure out if this message is for us
		var isForMe = true;
		if (msg.dest_id) {
			var nearestNode = routingutil.getNearestId(msg.dest_id, this.leafset);
			if (nearestNode && nearestNode !== node.nodeId)
				isForMe = false;
		}
		
		// if is for me, emit received, else emit forward
		
		var parsedUri = uri.parse(msg.uri);
		if (parsedUri.app_name === 'graviti') {
			if (parsedUri.resource.indexOf('/bootstraptarget') === 0) {
				util.log('Bootstrap message');
				//node.send(msg);
			}
		}
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
	
	//
	// Leave the overlay, if we're part of it. Do this nicely, by letting
	// other nodes know, then tear down the node and exit.
	leave : function() {
		if (this.bootstrappingIntervalId)
			clearInterval(this.bootstrappingIntervalId);
		
		// todo: send parting message
		
		node.stop();
	}
});