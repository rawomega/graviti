var logger = require('logmgr').getDefaultLogger();
var multinode = require('testability/multinode');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');
var ringutil = require('overlay/pastry/ringutil');

module.exports = {
	"message routing" : nodeunit.testCase({
		setUp : function(done) {
			var _this = this;
			var numNodes = 16;
			var testServersStarted = 0;
			this.nodes = multinode.start({
				num_nodes : numNodes,
								
				testServerStarted : function(idx) {
					_this.nodes.select(idx).eval(evalfuncs.smallLeafsetSize, undefined, function() {
						testServersStarted++;
						if (testServersStarted >= numNodes)
							done();						
					});
				}
			});
		},
		
		tearDown : function(done) {
			for (var nodeIdx in this.nodes.nodeIds) {
				logger.info('Node ' + nodeIdx + ' id: ' + this.nodes.nodeIds[nodeIdx]);
			}
			this.nodes.stopNow();
			setTimeout(function() {
				logger.info('\n\n========\n\n');	
				done();
			}, 2000);
		},

		"should route a number of messages for randomly generated ids to the right node" : function(test) {
			var _this = this;			
			
			this.nodes.selectAll().eval(evalfuncs.trackReceivedMessages, test);
			
			// wait till leafset is sorted
			this.nodes.selectAll().waitUntilAtLeast(6, evalfuncs.getLeafsetSize, test);
			
			// send some messages and ensure they are received where expected
			var expectedReceivedMessages = {};
			var numSends = 10;
setTimeout(function() {			
			for (var i = 0; i < numSends; i++) {				
				_this.nodes.select(i).eval(evalfuncs.sendMessageToRandomId, test, function(randomId) {
					var nearestNodeId = ringutil.getNearestId(randomId, _this.nodes.nodeIds).nearest;
					var nearestNodeIndex = _this.nodes.nodeIds.indexOf(nearestNodeId);
					logger.info('SHOULD HAVE SENT msg to random id ' + randomId + ' to ' + nearestNodeId + ' (node ' + nearestNodeIndex + ')');					
					expectedReceivedMessages[randomId] = nearestNodeIndex; 
				});
			}
	
			// now see that sent messages arrived where expected
			setTimeout(function() {
				var messagesFound = 0;
				Object.keys(expectedReceivedMessages).forEach(function(destId) {
					var expectedReceivingNode = expectedReceivedMessages[destId];
					_this.nodes.select(expectedReceivingNode).eval(evalfuncs.getReceivedMessages, test, function(msgs) {
						for (var msgIdx in msgs) {
							var msg = msgs[msgIdx];
							if (msg.dest_id === destId) {
								messagesFound++;
								if (messagesFound >= numSends)
									_this.nodes.done(test);
								
								return;
							}
						}
						
						test.fail("Expected message sent to " + destId + " on node " + expectedReceivingNode + ", but did not find it there - instead found " + JSON.stringify(msgs));
						_this.nodes.done(test);
					});
				});
				
			}, 3000);
}, 3000);			
		}
	})
};