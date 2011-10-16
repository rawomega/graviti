var logger = require('logmgr').getDefaultLogger();
var testing = require('testing');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');

module.exports = {
	"large ring setup and management" : nodeunit.testCase({
		setUp : function(done) {
			var self = this;
			testing.createRing({
				wait_timeout_msec : 10000,
				num_nodes : 16,
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

		"a set of nodes starting up simulaneously should self-organise" : function(test) {
			var self = this;			
			
			// wait till leafset is sorted
			self.ring.select(0).waitUntilAtLeast(15, evalfuncs.getLeafsetSize, test);
			self.ring.select(15).waitUntilAtLeast(15, evalfuncs.getLeafsetSize, test, function() {
				self.ring.done(test);
			});
		}
	})
};