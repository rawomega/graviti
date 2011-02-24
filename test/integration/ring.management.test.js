var util = require('util');
var multinode = require('testability/multinode');
var nodeunit = require('nodeunit');

module.exports = {
	"start and stop a multi-node ring" : nodeunit.testCase({
		setUp : function(done) {
			this.nodeIds = [
			    '0000000000000000000000000000000000000000',
			    '4444444444444444444444444444444444444444',
			    '8888888888888888888888888888888888888888',
			    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
			];
			this.nodes = multinode.start({
				node_ids : this.nodeIds
			});
			this.getLeafsetSize = function() {
				return Object.keys(require('core/leafsetmgr').leafset).length;
			};

			done();
		},
		
		tearDown : function(done) {
			multinode.stop(this.nodes);
			done();
		},

		"should populate leafsets after bootstrapping" : function(test) {
			var _this = this;
			var getLeafset = function() {
				return require('core/leafsetmgr').leafset;
			};
			var getRoutingTable = function() {
				return require('core/routingmgr').routingTable;
			};
			
			// wait till leafset is sorted
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.select(3).waitUntilEqual(3, this.getLeafsetSize, test);
				
			// leafset populated
			this.nodes.select(3).eval(getLeafset, test, function(res) {
				test.equal(3, Object.keys(res).length);
				test.ok(res[_this.nodeIds[0]] !== undefined);
				test.ok(res[_this.nodeIds[1]] !== undefined);
				test.ok(res[_this.nodeIds[2]] !== undefined);
			});

			// routing table populated
			this.nodes.select(3).eval(getRoutingTable, test, function(res) {
				test.equal(_this.nodeIds[0], res[0][0].id);
				test.equal(_this.nodeIds[1], res[0][4].id);
				test.equal(_this.nodeIds[2], res[0][8].id);
					
				_this.nodes.done(test);
			});
		},

		"should send and receive a bundle of messages" : function(test) {
			var _this = this;
			
			var trackReceivedMessages = function() {
				var app = require('core/appmgr').apps[0];				
				require('core/overlay').on(app.name + '-app-message-received', function(msg, msginfo) {						
					if (!app.receivedMessages)
						app.receivedMessages = [];
					if (msg.content.testecho === 'ping')
						app.receivedMessages.push(msg);
				});
			};
			
			var sendMessage = function() {
				require('core/appmgr').apps[0].send(
						'p2p:echoapp/somewhere', {testecho : 'ping'}, {method : 'POST'});
			};
			
			var countMessages = function() {
				var app = require('core/appmgr').apps[0];
				return app.receivedMessages === undefined ? 0 : app.receivedMessages.length;
			};			
			
			// wait till leafset is sorted
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);				
			this.nodes.selectAll().eval(trackReceivedMessages, test);
			this.nodes.selectAll().eval(sendMessage, test);
			this.nodes.select(1).waitUntilEqual(4, countMessages, test, function() {
				_this.nodes.done(test);
			});
		}		
	})
};