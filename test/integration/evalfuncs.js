var nodeunit = require('nodeunit');

module.exports = {
	getLeafsetSize : function(node) {
		return Object.keys(node.leafset.compressedLeafset()).length;
	},
	
	clearDeadPeersListInLeafset : function(node) {
		node.leafset._deadset = {};
	},
	
	getLeafset : function(node) {
		return node.leafset.compressedLeafset();
	},
	
	smallLeafsetSize : function(node) {
		node.leafset.leafsetSize = 6;	
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
	
	heartbeatFrequently : function(node) {
		var heartbeater = node.heartbeater;
		
		heartbeater.heartbeatIntervalMsec = 1000;
		heartbeater.stop(false);
		heartbeater.start();
	},
	
	trackReceivedMessages : function(node) {
		node.on('app-message-received', function(msg, msginfo) {
			if (!node.receivedMessages)
				node.receivedMessages = [];
			if (msg.content.subject === 'test' || msg.content_type === 'text/plain') {
				console.log('\n\nNNNNNNNNNNNNN ' + node.transport.nodeId + '\n' + JSON.stringify(msg));
				node.receivedMessages.push(msg);
			}
		});
	},
	
	countMessages : function(node) {
		return node.receivedMessages === undefined ? 0 : node.receivedMessages.length;
	},
	
	getReceivedMessages : function(node) {
		return node.receivedMessages === undefined ? [] : node.receivedMessages;
	},
	
	trackReceivedPeerArrivedAndDepartedEvents : function(node) {
		node.on('peer-arrived', function(id) {						
			if (!node.arrivedPeers)
				node.arrivedPeers = [];
			node.arrivedPeers.push(id);
		});
		node.on('peer-departed', function(id) {						
			if (!node.departedPeers)
				node.departedPeers = [];
			node.departedPeers.push(id);
		});
	},
	
	getPeerArrivedEvents : function(node) {
		return node.arrivedPeers;
	},
	
	getPeerDepartedEvents : function(node) {
		return node.departedPeers;
	},
	
	sendMessageToId : function(node) {
		node.transport.sendToId('p2p:echoapp/departednodetest',
				{subject : 'test'}, {method : 'POST'}, 'B111111111111111111111111111111111111111');
	},
	
	sendMessageToRandomId : function(node) {
		var randomId = require('ringutil').generateNodeId();
		node.transport.sendToId('p2p:echoapp/departednodetest',
				{subject : 'test'}, {method : 'POST'}, randomId);
		return randomId;
	}
}
