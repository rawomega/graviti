var winston = require('winston');
var multinode = require('testability/multinode');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');

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
				num_nodes : 16
			});

			done();
		},
		
		tearDown : function(done) {
			this.nodes.stopNow();
			setTimeout(function() {
				winston.info('\n\n========\n\n');	
				done();
			}, 2000);
		},

		"a set of nodes starting up simulaneously should self-organise" : function(test) {
			var _this = this;			
			
			// wait till leafset is sorted
			_this.nodes.select(0).waitUntilAtLeast(15, evalfuncs.getLeafsetSize, test);
			_this.nodes.select(15).waitUntilAtLeast(15, evalfuncs.getLeafsetSize, test, function() {
				_this.nodes.done(test);
			});
		}
	})
};