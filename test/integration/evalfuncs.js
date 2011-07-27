var nodeunit = require('nodeunit');

module.exports = {
	getLeafsetSize : function(node) {
		return Object.keys(node.leafset.compressedLeafset()).length;
	},
	
	clearDeadPeersListInLeafset : function() {
		require('pastry/leafset')._deadset = {};
	},
	
	getLeafset : function(node) {
		return node.leafset.compressedLeafset();
	},
	
	smallLeafsetSize : function() {
		require('pastry/leafset').leafsetSize = 6;	
	},
	
	getRoutingTable : function(node) {
		return node.bootstrapper.routingtable._table;
	},
	
	getRoutingTableSize : function(node) {
		var res = 0;
		node.bootstrapper.routingtable.each(function() {
			res++;
		});
		return res;
	},
	
	heartbeatFrequently : function() {
		var heartbeater = require('pastry/heartbeater');
		var overlay = require('pastry/overlay');
		
		heartbeater.heartbeatIntervalMsec = 1000;
		heartbeater.stop(false);
		heartbeater.start(overlay);
	},
	
	trackReceivedMessages : function() {
		var app = require('core/appmgr').apps[0];
		require('pastry/overlay').on(app.name + '-app-message-received', function(msg, msginfo) {
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
		require('pastry/overlay').sendToId('p2p:echoapp/departednodetest',
				{subject : 'test'}, {method : 'POST'}, 'B111111111111111111111111111111111111111');
	},
	
	sendMessageToRandomId : function() {
		var randomId = require('common/id').generateNodeId();
		require('pastry/overlay').sendToId('p2p:echoapp/departednodetest',
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