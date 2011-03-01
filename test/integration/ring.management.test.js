var util = require('util');
var multinode = require('testability/multinode');
var nodeunit = require('nodeunit');

module.exports = {
	"multi-node ring initialisation" : nodeunit.testCase({
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
				return Object.keys(require('core/leafsetmgr').compressedLeafset()).length;
			};
			this.heartbeatFrequently = function() {
				var heartbeater = require('core/heartbeater');
				var overlay = require('core/overlay');
				
				heartbeater.heartbeatIntervalMsec = 1000;
				heartbeater.stop(false);
				heartbeater.start(overlay);
			};
			this.trackReceivedMessages = function() {
				var app = require('core/appmgr').apps[0];				
				require('core/overlay').on(app.name + '-app-message-received', function(msg, msginfo) {						
					if (!app.receivedMessages)
						app.receivedMessages = [];
					if (msg.content.subject === 'test')
						app.receivedMessages.push(msg);
				});
			};
			this.countMessages = function() {
				var app = require('core/appmgr').apps[0];
				return app.receivedMessages === undefined ? 0 : app.receivedMessages.length;
			};

			done();
		},
		
		tearDown : function(done) {
			this.nodes.stopNow();
			setTimeout(function() {
				util.log('\n\n========\n\n');
				done();
			}, 2000);
		},

		"should populate leafsets after bootstrapping" : function(test) {
			var _this = this;
			var getLeafset = function() {
				return require('core/leafsetmgr').compressedLeafset();
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
			var sendMessage = function() {
				require('core/appmgr').apps[0].send(
						'p2p:echoapp/somewhere', {subject : 'test'}, {method : 'POST'});
			};			

			// wait till leafset is sorted
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);				
			this.nodes.selectAll().eval(this.trackReceivedMessages, test);
			this.nodes.selectAll().eval(sendMessage, test);
			this.nodes.select(1).waitUntilAtLeast(4, this.countMessages, test, function() {
				_this.nodes.done(test);
			});
		},
	
		"should exchange heartbeats with leafset peers" : function(test) {
			var _this = this;
			
			var trackReceivedHeartbeats = function() {
				var overlay = require('core/overlay');				
				overlay.on('graviti-message-received', function(msg, msginfo) {		
					if (!overlay.receivedHeartbeats)
						overlay.receivedHeartbeats = {};
					if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
						if (overlay.receivedHeartbeats[msg.source_id] === undefined)
							overlay.receivedHeartbeats[msg.source_id] = [];
						overlay.receivedHeartbeats[msg.source_id].push(msg);
					}
				});
			};			
			
			var countReceivedHeartbeatsPerSender = function() {
				var coll = require('core/overlay').receivedHeartbeats;
				var res = {};
				if (!coll)
					return res;
				
				for (var id in coll) {
					res[id] = coll[id].length;
				}
				return res;
			};
			
			var countReceivedHeartbeats = function() {
				var coll = require('core/overlay').receivedHeartbeats;
				var res = 0;
				if (!coll)
					return res;
				
				for (var id in coll) {
					res += coll[id].length;
				}
				return res;
			};
			
			// get leafset going, start tracking messages, make all nodes heartbeat every 1s
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);				
			this.nodes.selectAll().eval(trackReceivedHeartbeats, test);
			this.nodes.selectAll().eval(this.heartbeatFrequently, test);
			this.nodes.select(1).waitUntilAtLeast(8, countReceivedHeartbeats, test);			
	
			// check that on 2 different nodes we've had at least 1 heartbeat from every other node
			this.nodes.select(0).eval(countReceivedHeartbeatsPerSender, test, function(res) {
				test.ok(res[_this.nodeIds[1]] > 1);
				test.ok(res[_this.nodeIds[2]] > 1);
				test.ok(res[_this.nodeIds[3]] > 1);
			});
			this.nodes.select(2).eval(countReceivedHeartbeatsPerSender, test, function(res) {
				test.ok(res[_this.nodeIds[0]] > 1);
				test.ok(res[_this.nodeIds[1]] > 1);
				test.ok(res[_this.nodeIds[3]] > 1);
				_this.nodes.done(test);
			});
		},
		
		"should be able to deal with departed nodes" : function(test) {
			var _this = this;
			
			var sendMessageToId = function() {
				require('core/overlay').sendToId('p2p:echoapp/departednodetest',
						{subject : 'test'}, {method : 'POST'}, 'B111111111111111111111111111111111111111');
			};
			var trackReceivedPeerDepartedEvents = function() {
				var app = require('core/appmgr').apps[0];				
				app.peerDeparted = function(id) {						
					if (!app.departedPeers)
						app.departedPeers = [];
					app.departedPeers.push(id);
				};
			};
			var getPeerDepartedEvents = function() {
				return require('core/appmgr').apps[0].departedPeers;
			};
			var clearDeadPeersListInLeafset = function() {
				require('core/leafsetmgr')._deadset = {};
			};

			this.nodes.select(3).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.selectAll().eval(this.trackReceivedMessages, test);
			this.nodes.selectAll().eval(trackReceivedPeerDepartedEvents, test);

			// send message to id closest to node 3 and make sure it is received
			this.nodes.select(1).eval(sendMessageToId, test);
			this.nodes.select(3).waitUntilEqual(1, this.countMessages, test);
			
			// stop node 3, and make sure it is take out of 1's leafset
			this.nodes.select(3).stop();
			this.nodes.select(1).waitUntilEqual(2, this.getLeafsetSize, test);
			this.nodes.select(2).eval(getPeerDepartedEvents, test, function(res) {
				test.equal(_this.nodeIds[3], res[0]);
			});
			
			// send same message to same id, make sure it is now received on node 2
			this.nodes.select(1).eval(sendMessageToId, test);
// Re-enable this line after we're able to handle routing table failures / retries 			
//			this.nodes.select(2).waitUntilEqual(1, this.countMessages, test);
			
			// now bring node 3 back, after clearing departed node from dead peer set 
			this.nodes.select([0,1,2]).eval(clearDeadPeersListInLeafset, test);
			this.nodes.select(3).start();
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.select(3).eval(this.trackReceivedMessages, test);
			
			// ... and make sure that same message now goes there and not elsewhere
			this.nodes.select(0).eval(sendMessageToId, test);
			this.nodes.select(3).waitUntilEqual(1, this.countMessages, test);
			this.nodes.select(0).waitUntilEqual(0, this.countMessages, test);			
			this.nodes.select(2).waitUntilEqual(0, this.countMessages, test, function() {
				_this.nodes.done(test);		
			});
		}
	})
};