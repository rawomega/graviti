var logger = require('logmgr').getDefaultLogger();
var testing = require('testing');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');

module.exports = {
	"multi-node ring initialisation" : nodeunit.testCase({
		setUp : function(done) {
			var self = this;
			this.nodeIds = [
			    '0000000000000000000000000000000000000000',
			    '4444444444444444444444444444444444444444',
			    '8888888888888888888888888888888888888888',
			    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
			];
			testing.createRing({
				node_ids : this.nodeIds,
				success : function(ring) {				
					self.ring = ring;
					done();
				}
			});
		},
		
		tearDown : function(done) {
			this.ring.stopNow();
			setTimeout(function() {
				logger.info('\n\n========\n\n');	
				done();
			}, 2000);
		},

/*        "should populate leafsets after bootstrapping" : function(test) {
			var self = this;
			
			// wait till leafset is sorted
			this.ring.select([0,3]).waitUntilEqual(3, evalfuncs.getLeafsetSize, test);
			this.ring.select(3).waitUntilEqual(3, evalfuncs.getRoutingTableSize, test);
				
			// leafset populated
			this.ring.select(3).eval(evalfuncs.getLeafset, test, function(res) {
				test.equal(3, Object.keys(res).length);
				test.ok(res[self.nodeIds[0]] !== undefined);
				test.ok(res[self.nodeIds[1]] !== undefined);
				test.ok(res[self.nodeIds[2]] !== undefined);
			});

			// routing table populated
			this.ring.select(3).eval(evalfuncs.getRoutingTable, test, function(res) {
				test.equal(self.nodeIds[0], res[0][0].id);
				test.equal(self.nodeIds[1], res[0][4].id);
				test.equal(self.nodeIds[2], res[0][8].id);
					
				self.ring.done(test);
			});
		},

		"should send and receive a bundle of messages" : function(test) {
			var self = this;
			var sendSmallMessage = function() {
				self.ring.nodes[0].send(
						'p2p:echoapp/somewhere', {subject : 'test'}, {method : 'POST'});
			};
			var sendLargeMessage = function() {
				var content = '';
				for (var i = 0; i < 50000; i++)
					content += Math.round(9 * Math.random());

				self.ring.nodes[0].send(
						'p2p:echoapp/somewhere', content, {method : 'POST', content_type : 'text/plain'});
			};

			// wait till leafset is sorted
			this.ring.select(0).waitUntilEqual(3, evalfuncs.getLeafsetSize, test);				
			this.ring.selectAll().eval(evalfuncs.trackReceivedMessages, test);
			this.ring.selectAll().eval(sendSmallMessage, test);
			this.ring.select(1).waitUntilAtLeast(4, evalfuncs.countMessages, test);
			this.ring.selectAll().eval(sendLargeMessage, test);
			this.ring.select(1).waitUntilAtLeast(8, evalfuncs.countMessages, test, function() {
				self.ring.done(test);
			});
		},
	
		"should exchange heartbeats with leafset peers" : function(test) {
			var self = this;
			
			var trackReceivedHeartbeats = function(node) {				
				node.transport.on('graviti-message-received', function(msg, msginfo) {		
					if (!node.receivedHeartbeats)
						node.receivedHeartbeats = {};			
					if (/\/heartbeat/.test(msg.uri) && msg.method === 'POST') {
						if (node.receivedHeartbeats[msg.source_id] === undefined)
							node.receivedHeartbeats[msg.source_id] = [];
						node.receivedHeartbeats[msg.source_id].push(msg);
					}
				});
			};			
			
			var countReceivedHeartbeatsPerSender = function(node) {
				var coll = node.receivedHeartbeats;
				var res = {};
				if (!coll)
					return res;
				
				for (var id in coll) {
					res[id] = coll[id].length;
				}
				return res;
			};
			
			var countReceivedHeartbeats = function(node) {
				var coll = node.receivedHeartbeats;
				var res = 0;
				if (!coll)
					return res;
				
				for (var id in coll) {
					res += coll[id].length;
				}
				return res;
			};
			
			// get leafset going, start tracking messages, make all nodes heartbeat every 1s
			this.ring.select(0).waitUntilEqual(3, evalfuncs.getLeafsetSize, test);				
			this.ring.selectAll().eval(trackReceivedHeartbeats, test);
			this.ring.selectAll().eval(evalfuncs.heartbeatFrequently, test);
			this.ring.select(1).waitUntilAtLeast(8, countReceivedHeartbeats, test);			
	
			// check that on 2 different nodes we've had at least 1 heartbeat from every other node
			this.ring.select(0).eval(countReceivedHeartbeatsPerSender, test, function(res) {
				test.ok(res[self.nodeIds[1]] >= 1);
				test.ok(res[self.nodeIds[2]] >= 1);
				test.ok(res[self.nodeIds[3]] >= 1);
			});
			this.ring.select(2).eval(countReceivedHeartbeatsPerSender, test, function(res) {
				test.ok(res[self.nodeIds[0]] >= 1);
				test.ok(res[self.nodeIds[1]] >= 1);
				test.ok(res[self.nodeIds[3]] >= 1);
				self.ring.done(test);
			});
		},

		"should be able to deal with orderly departure and return of a node" : function(test) {
			var self = this;

			// initialisation stuff
            this.ring.selectAll().waitUntilEqual(3, evalfuncs.getLeafsetSize, test);
            this.ring.selectAll().eval(evalfuncs.trackReceivedMessages, test);            
			this.ring.selectAll().eval(evalfuncs.trackReceivedPeerArrivedAndDepartedEvents, test);

			// stop node 3, make sure it is take out of 1's leafset, and that 2 receives a peer departed event
            this.ring.select(3).eval( function(node) { node.stop(); }, test);
            this.ring.select([0,1,2]).waitUntilEqual(2, evalfuncs.getLeafsetSize, test);
			this.ring.select(2).waitUntilEqual([this.nodeIds[3]], evalfuncs.getPeerDepartedEvents, test);
			
			// send same message to same id, make sure it is now received on node 2
			this.ring.select(1).eval(evalfuncs.sendMessageToId, test);
            this.ring.select(2).waitUntilEqual(1, evalfuncs.countMessages, test);
			
			// now bring node 3 back and wait for arrived event, after clearing departed node from dead peer set 
            this.ring.select([0,1,2]).eval(evalfuncs.clearDeadPeersListInLeafset, test);            
			this.ring.select(3).eval( function(node) {node.joinRing('localhost:7100');}, test);
            this.ring.select([0,1,2]).waitUntilEqual(3, evalfuncs.getLeafsetSize, test);
			this.ring.select(2).waitUntilEqual([this.nodeIds[3]], evalfuncs.getPeerArrivedEvents, test);
			
			// ... and make sure that same message now goes there and not elsewhere
			this.ring.select(0).eval(evalfuncs.sendMessageToId, test);
			this.ring.select(3).waitUntilEqual(1, evalfuncs.countMessages, test);
			this.ring.select(0).waitUntilEqual(0, evalfuncs.countMessages, test);
            this.ring.select(2).waitUntilEqual(1, evalfuncs.countMessages, test, function() {
				self.ring.done(test);		
			});
		},
*/
        "should be able to deal with sudden departure of a node" : function(test) {
			var self = this;
			
			var clearOutLeafset = function(node) {
				node.leafset.reset();
				//node.transport.stop();
			};
			
			var setShortHeartbeatTimeout = function(node) {
				node.leafset.timedOutPeerIntervalMsec = 3000;
				node.heartbeater.timedOutPeerCheckIntervalMsec = 500;
				node.heartbeater.stop(false);
				node.heartbeater.start();
			};
			
			// initialisation stuff
            this.ring.selectAll().waitUntilEqual(3, evalfuncs.getLeafsetSize, test);
			this.ring.selectAll().eval(evalfuncs.heartbeatFrequently, test);
			this.ring.selectAll().eval(setShortHeartbeatTimeout, test);
			this.ring.selectAll().eval(evalfuncs.trackReceivedPeerArrivedAndDepartedEvents, test);
			
			// clear out leafset on 3 so it doesnt send out messages when departing
			this.ring.select(3).eval(clearOutLeafset, test);
			
			// stop node 3, make sure it is take out of 1's leafset, and that 2 receives a peer departed event
			this.ring.select(3).eval( function(node) {node.stop();}, test);
			this.ring.select([0,1,2]).waitUntilEqual(2, evalfuncs.getLeafsetSize, test);
			this.ring.select(2).waitUntilEqual([this.nodeIds[3]], evalfuncs.getPeerDepartedEvents, test);
			
			// send same message to same id, make sure it is now received on node 2
			this.ring.select(1).eval(evalfuncs.sendMessageToId, test);
// Re-enable this line after we're able to handle routing table failures / retries 			
//			this.ring.select(2).waitUntilEqual(1, evalfuncs.countMessages, test);
			
			// now bring node 3 back and wait for arrived event, after clearing departed node from dead peer set 
			this.ring.select([0,1,2]).eval(evalfuncs.clearDeadPeersListInLeafset, test);
			this.ring.select(3).eval( function(node) {node.joinRing('localhost:7100');}, test);
            this.ring.select([0,1,2]).waitUntilEqual(3, evalfuncs.getLeafsetSize, test);
			this.ring.select(2).waitUntilEqual([this.nodeIds[3]], evalfuncs.getPeerArrivedEvents, test);
			this.ring.select(3).eval(evalfuncs.trackReceivedMessages, test);
			
			// ... and make sure that same message now goes there and not elsewhere
			this.ring.select(0).eval(evalfuncs.sendMessageToId, test);
			this.ring.select(3).waitUntilEqual(1, evalfuncs.countMessages, test);
			this.ring.select(0).waitUntilEqual(0, evalfuncs.countMessages, test);			
			this.ring.select(2).waitUntilEqual(0, evalfuncs.countMessages, test, function() {
				self.ring.done(test);
			});
		}
     })
};