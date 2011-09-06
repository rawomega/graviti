var logger = require('logmgr').getDefaultLogger();
var testing = require('testing');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');
var ringutil = require('ringutil');

module.exports = {
	"message routing" : nodeunit.testCase({
		setUp : function(done) {
			var self = this;
			var numNodes = 16;
			testing.createRing({
				num_nodes : numNodes,
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

		"should route a number of messages for randomly generated ids to the right node" : function(test) {
			var self = this;			
			
			this.ring.selectAll().eval(evalfuncs.trackReceivedMessages, test);
			
			// wait till leafset is sorted
			this.ring.selectAll().waitUntilAtLeast(6, evalfuncs.getLeafsetSize, test);
			
			// send some messages and ensure they are received where expected
			var expectedReceivedMessages = {};
			var numSends = 10;
setTimeout(function() {			
			for (var i = 0; i < numSends; i++) {				
				self.ring.select(i).eval(evalfuncs.sendMessageToRandomId, test, function(randomId) {
					var nearestNodeId = ringutil.getNearestId(randomId, self.ring.nodeIds).nearest;
					var nearestNodeIndex = self.ring.nodeIds.indexOf(nearestNodeId);
					logger.info('SHOULD HAVE SENT msg to random id ' + randomId + ' to ' + nearestNodeId + ' (node ' + nearestNodeIndex + ')');					
					expectedReceivedMessages[randomId] = nearestNodeIndex; 
				});
			}
	
			// now see that sent messages arrived where expected
			setTimeout(function() {
				var messagesFound = 0;
				Object.keys(expectedReceivedMessages).forEach(function(destId) {
					var expectedReceivingNode = expectedReceivedMessages[destId];
					self.ring.select(expectedReceivingNode).eval(evalfuncs.getReceivedMessages, test, function(msgs) {
						for (var msgIdx in msgs) {
							var msg = msgs[msgIdx];
							if (msg.dest_id === destId) {
								messagesFound++;
								if (messagesFound >= numSends)
									self.ring.done(test);
								
								return;
							}
						}
						
						test.fail("Expected message sent to " + destId + " on node " + expectedReceivingNode + ", but did not find it there - instead found " + JSON.stringify(msgs));
						self.ring.done(test);
					});
				});
				
			}, 3000);
}, 3000);			
		}
	})
};