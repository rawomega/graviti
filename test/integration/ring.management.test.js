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
				return Object.keys(require('core/leafset').compressedLeafset()).length;
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
					if (msg.content.subject === 'test' || msg.content_type === 'text/plain')
						app.receivedMessages.push(msg);
				});
			};
			this.countMessages = function() {
				var app = require('core/appmgr').apps[0];
				return app.receivedMessages === undefined ? 0 : app.receivedMessages.length;
			};
			this.sendMessageToId = function() {
				require('core/overlay').sendToId('p2p:echoapp/departednodetest',
						{subject : 'test'}, {method : 'POST'}, 'B111111111111111111111111111111111111111');
			};
			this.trackReceivedPeerArrivedAndDepartedEvents = function() {
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
			};
			this.getPeerArrivedEvents = function() {
				return require('core/appmgr').apps[0].arrivedPeers;
			};
			this.getPeerDepartedEvents = function() {
				return require('core/appmgr').apps[0].departedPeers;
			};
			this.clearDeadPeersListInLeafset = function() {
				require('core/leafset')._deadset = {};
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
				return require('core/leafset').compressedLeafset();
			};
			var getRoutingTable = function() {
				return require('core/routingtable')._table;
			};
			var getRoutingTableSize = function() {
				var res = 0;
				require('core/routingtable').each(function() {
					res++
				});
				return res;
			};
			
			// wait till leafset is sorted
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.select(3).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.select(3).waitUntilEqual(3, getRoutingTableSize, test);
				
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
			var sendSmallMessage = function() {
				require('core/appmgr').apps[0].send(
						'p2p:echoapp/somewhere', {subject : 'test'}, {method : 'POST'});
			};
			var sendLargeMessage = function() {
				var content = '';
				for (var i = 0; i < 40000; i++)
					content += Math.round(9 * Math.random());
				require('core/appmgr').apps[0].send(
						'p2p:echoapp/somewhere', content, {method : 'POST', content_type : 'text/plain'});
			};

			// wait till leafset is sorted
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);				
			this.nodes.selectAll().eval(this.trackReceivedMessages, test);
			this.nodes.selectAll().eval(sendSmallMessage, test);
			this.nodes.select(1).waitUntilAtLeast(4, this.countMessages, test);
			this.nodes.selectAll().eval(sendLargeMessage, test);
			this.nodes.select(1).waitUntilAtLeast(8, this.countMessages, test, function() {
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
		
		"should be able to deal with orderly departure and return of a node" : function(test) {
			var _this = this;

			// initialisation stuff
			this.nodes.select(3).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.selectAll().eval(this.trackReceivedMessages, test);
			this.nodes.selectAll().eval(this.trackReceivedPeerArrivedAndDepartedEvents, test);

			// stop node 3, make sure it is take out of 1's leafset, and that 2 receives a peer departed event
			this.nodes.select(3).stop();
			this.nodes.select(1).waitUntilEqual(2, this.getLeafsetSize, test);
			this.nodes.select(2).waitUntilEqual([this.nodeIds[3]], this.getPeerDepartedEvents, test);
			
			// send same message to same id, make sure it is now received on node 2
			this.nodes.select(1).eval(this.sendMessageToId, test);
// Re-enable this line after we're able to handle routing table failures / retries 			
//			this.nodes.select(2).waitUntilEqual(1, this.countMessages, test);
			
			// now bring node 3 back and wait for arrived event, after clearing departed node from dead peer set 
			this.nodes.select([0,1,2]).eval(this.clearDeadPeersListInLeafset, test);
			this.nodes.select(3).start();
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.select(2).waitUntilEqual([this.nodeIds[3]], this.getPeerArrivedEvents, test);
			this.nodes.select(3).eval(this.trackReceivedMessages, test);
			
			// ... and make sure that same message now goes there and not elsewhere
			this.nodes.select(0).eval(this.sendMessageToId, test);
			this.nodes.select(3).waitUntilEqual(1, this.countMessages, test, function() {
console.log('\n\naaaaaaaaa\n\n');							
			});
			this.nodes.select(0).waitUntilEqual(0, this.countMessages, test, function() {
console.log('\n\nbbbbbbbbb\n\n');				
			});
			this.nodes.select(2).waitUntilEqual(0, this.countMessages, test, function() {
console.log('\n\cccccccccc\n\n');
				_this.nodes.done(test);		
			});
		},

		"should be able to deal with sudden departure of a node" : function(test) {
			var _this = this;
			
			var clearOutLeafset = function() {
				require('core/leafset').reset();
				require('core/connmgr').stopListening();				
			};
			
			var setShortHeartbeatTimeout = function() {
				var heartbeater = require('core/heartbeater');
				heartbeater.timedOutPeerCheckIntervalMsec = 500;
				heartbeater.timedOutPeerIntervalMsec = 3000;
				heartbeater.stop(false);
				heartbeater.start(require('core/overlay'));
			};
			
			// initialisation stuff
			this.nodes.select(3).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.selectAll().eval(this.heartbeatFrequently, test);
			this.nodes.selectAll().eval(setShortHeartbeatTimeout, test);
			this.nodes.selectAll().eval(this.trackReceivedPeerArrivedAndDepartedEvents, test);
			
			// clear out leafset on 3 so it doesnt send out messages when departing
			this.nodes.select(3).eval(clearOutLeafset, test);
			
			// stop node 3, make sure it is take out of 1's leafset, and that 2 receives a peer departed event
			this.nodes.select(3).stop();
			this.nodes.select([0,1,2]).waitUntilEqual(2, this.getLeafsetSize, test);
			this.nodes.select(2).waitUntilEqual([this.nodeIds[3]], this.getPeerDepartedEvents, test);
			
			// send same message to same id, make sure it is now received on node 2
			this.nodes.select(1).eval(this.sendMessageToId, test);
// Re-enable this line after we're able to handle routing table failures / retries 			
//			this.nodes.select(2).waitUntilEqual(1, this.countMessages, test);
			
			// now bring node 3 back and wait for arrived event, after clearing departed node from dead peer set 
			this.nodes.select([0,1,2]).eval(this.clearDeadPeersListInLeafset, test);
			this.nodes.select(3).start();
			this.nodes.select(0).waitUntilEqual(3, this.getLeafsetSize, test);
			this.nodes.select(2).waitUntilEqual([this.nodeIds[3]], this.getPeerArrivedEvents, test);
			this.nodes.select(3).eval(this.trackReceivedMessages, test);
			
			// ... and make sure that same message now goes there and not elsewhere
			this.nodes.select(0).eval(this.sendMessageToId, test);
			this.nodes.select(3).waitUntilEqual(1, this.countMessages, test);
			this.nodes.select(0).waitUntilEqual(0, this.countMessages, test);			
			this.nodes.select(2).waitUntilEqual(0, this.countMessages, test, function() {
				_this.nodes.done(test);
			});
		}
	})
};