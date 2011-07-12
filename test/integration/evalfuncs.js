var nodeunit = require('nodeunit');

module.exports = {
	getLeafsetSize : function() {
		return Object.keys(require('overlay/leafset').compressedLeafset()).length;
	},
	
	clearDeadPeersListInLeafset : function() {
		require('overlay/leafset')._deadset = {};
	},
	
	getLeafset : function() {
		return require('overlay/leafset').compressedLeafset();
	},
	
	smallLeafsetSize : function() {
		require('overlay/leafset').leafsetSize = 6;	
	},
	
	getRoutingTable : function() {
		return require('overlay/routingtable')._table;
	},
	
	getRoutingTableSize : function() {
		var res = 0;
		require('overlay/routingtable').each(function() {
			res++
		});
		return res;
	},
	
	heartbeatFrequently : function() {
		var heartbeater = require('overlay/heartbeater');
		var overlay = require('overlay/overlay');
		
		heartbeater.heartbeatIntervalMsec = 1000;
		heartbeater.stop(false);
		heartbeater.start(overlay);
	},
	
	trackReceivedMessages : function() {
		var app = require('core/appmgr').apps[0];
		require('overlay/overlay').on(app.name + '-app-message-received', function(msg, msginfo) {
			if (!app.receivedMessages)
				app.receivedMessages = [];
			if (msg.content.subject === 'test' || msg.content_type === 'text/plain')
				app.receivedMessages.push(msg);
		});
	},
	
	countMessages : function() {
		var app = require('core/appmgr').apps[0];
		return app.receivedMessages === undefined ? 0 : app.receivedMessages.length;
	},
	
	getReceivedMessages : function() {
		var app = require('core/appmgr').apps[0];
		return app.receivedMessages === undefined ? [] : app.receivedMessages;
	},
	
	sendMessageToId : function() {
		require('overlay/overlay').sendToId('p2p:echoapp/departednodetest',
				{subject : 'test'}, {method : 'POST'}, 'B111111111111111111111111111111111111111');
	},
	
	sendMessageToRandomId : function() {
		var randomId = require('common/id').generateNodeId();
		require('overlay/overlay').sendToId('p2p:echoapp/departednodetest',
				{subject : 'test'}, {method : 'POST'}, randomId);
		return randomId;
	},
	
	trackReceivedPeerArrivedAndDepartedEvents : function() {
		var app = require('core/appmgr').apps[0];
		app.peerArrived = function(id) {						
			if (!app.arrivedPeers)
				app.arrivedPeers = [];
			app.arrivedPeers.push(id);
		};
		app.peerDeparted = function(id) {						
			if (!app.departedPeers)
				app.departedPeers = [];
			app.departedPeers.push(id);
		};
	},
	
	getPeerArrivedEvents : function() {
		return require('core/appmgr').apps[0].arrivedPeers;
	},
	
	getPeerDepartedEvents : function() {
		return require('core/appmgr').apps[0].departedPeers;
	}
}