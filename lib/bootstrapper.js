var util = require('util');
var node = require('./node');
var leafsetmgr = require('./leafsetmgr');

var self = module.exports = {
	overlayCallback : undefined,
	defaultPort : 4728,
	bootstrapping : false,
	bootstrappingIntervalId : undefined,
	bootstrapRetryIntervalMsec : 5000,
	bootstrapEndpoints : {},

	//
	// initiate a function (via setInterval) to check for any pending bootstrap messages and send them
	start : function(overlayCallback, bootstraps) {
		if (!bootstraps || bootstraps.length < 1)
			throw new Error('Invalid or missing bootstrap list ' + bootstraps);		
		
		self.overlayCallback = overlayCallback;
		
		util.log('Going to join overlay through bootstraps ' + bootstraps);
		var bootstrapParts = bootstraps.replace(/\s/g, '').split(',');
		for (var i = 0; i < bootstrapParts.length; i++) {			
			var endpointPort = self.defaultPort;
			var parts = bootstrapParts[i].split(':');
			var endpointAddr = parts[0];
			if (parts.length > 1)
				endpointPort = parts[1];
			
			self.bootstrapEndpoints[endpointAddr + ':' + endpointPort] = {
				last_attempt_at : 	0,
				last_response_at : 	0
			};
		}

		overlayCallback.on('graviti-message-received', self._handleReceivedGravitiMessage);
		self.bootstrapping = true;
		self.bootstrappingIntervalId = setInterval (self._sendPendingBootstrapRequests, 1000);
	},
	
	stop : function() {
		if (self.bootstrappingIntervalId)
			clearInterval(self.bootstrappingIntervalId);
	},
	
	_handleReceivedGravitiMessage : function(msg, msginfo) {
		if (msg.method === 'POST' && /\/statetables/.test(msg.uri)) {
			util.log('Bootstrap response from ' + msg.content.id + ' (' + msginfo.sender_addr + ':' + msginfo.sender_port + ')');

			leafsetmgr.updateLeafset(msg.content.leafset);
			leafsetmgr.updateLeafset(msg.content.id, msginfo.sender_addr + ':' + msginfo.sender_port); 
		}
	},
	
	//
	// when invoked, looks for any 'stale' bootstrap requests that have not been acknowledged and resends them 
	_sendPendingBootstrapRequests : function() {
		if (!self.bootstrapping)
			return;

		for (var endpoint in self.bootstrapEndpoints) {						
			var endpointData = self.bootstrapEndpoints[endpoint];				
			var now = new Date().getTime();
			if (endpointData && endpointData.last_attempt_at < (now - self.bootstrapRetryIntervalMsec)) {
				util.log('Sending bootstrap req to ' + endpoint);
				var endpointParts = endpoint.split(':');
				var content = {
						id : node.nodeId
				};
				self.overlayCallback.sendToAddr('p2p:graviti/statetables', content, {method : 'GET'}, endpointParts[0], endpointParts[1]);
				endpointData.last_attempt_at = now;
			}
		}			
	}
};