var logger = require('logmgr').getDefaultLogger();
var multinode = require('testability/multinode');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');

module.exports = {
	"proximity neighbor selection" : nodeunit.testCase({
		setUp : function(done) {
			var _this = this;
			this.nodeIds = [
					    '0000000000000000000000000000000000000000',
					    '4400000000000000000000000000000000000001',
					    '7111000000000000000000000000000000000002',
					    'CCCC000000000000000000000000000000000003',
					    '7700000000000000000000000000000000000004',
					    'CCCC333EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE05',
					    '4444CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC06',
					    '4444444411111111111111111111111111111107',
					    '4444EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE08',
					    '4444444466666666666666666666666666666609',
					    '4444777777777777777777777777777777777710',
					    '4444444433333333333333333333333333333311',
					    '4444999999999999999999999999999999999912',
					    'CCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF13',
					    '7111111111111111111111111111111111111114',
					    'CCCC333333333333333333333333333333333315',
					    '4444444444444444222222222222222222222216',
					    '7000000000000000000000000000000000000017'
					];
			
			this.delaySendsByPortDistance = function() {
				var connmgr = require('core/connmgr');
				var node = require('core/node');
				var oldSendFunc = connmgr.send;
				
				require('util').log('TEST: Adding a delay to all sends that is proportional to distance');
				connmgr.send = function(port, host, data) {
					var dist = Math.abs(node.port - port);
					
					setTimeout(function() {
						oldSendFunc(port, host, data);
					}, 60 * dist);
				};
			};
			
			var testServersStarted = 0;
			this.nodes = multinode.start({
				node_ids : this.nodeIds,
				wait_timeout_msec : 60000,
				
				testServerStarted : function(idx) {
					_this.nodes.select(idx).eval(_this.delaySendsByPortDistance);
					testServersStarted++;
					if (testServersStarted >= _this.nodeIds.length)
						done();
				}
			});
		},
		
		tearDown : function(done) {
			this.nodes.stopNow();
			setTimeout(function() {
				logger.info('\n\n========\n\n');	
				done();
			}, 2000);
		},

		"prefer closer peers" : function(test) {
			var _this = this;			
			
			// wait till leafset is sorted
			this.nodes.select(0).waitUntilAtLeast(this.nodeIds.length-1, evalfuncs.getLeafsetSize, test);			
			this.nodes.select(this.nodeIds.length-1).waitUntilAtLeast(this.nodeIds.length-1, evalfuncs.getLeafsetSize, test);
			
			// ensure close peers are preferred for node starting with 0 - these
			// are all row 0 peers 
			this.nodes.select(0).waitUntilAtLeast(3, evalfuncs.getRoutingTableSize, test);
			this.nodes.select(0).eval(evalfuncs.getRoutingTable, test, function(rt) {
				test.strictEqual('4400000000000000000000000000000000000001', rt['0']['4'].id);
				test.strictEqual('7111000000000000000000000000000000000002', rt['0']['7'].id);
				test.strictEqual('CCCC000000000000000000000000000000000003', rt['0']['C'].id);
			});
			
			// ensure close peers are preferred for node 3 - here we have a mix of row 0
			// peers and deeper peers
			this.nodes.select(3).waitUntilAtLeast(5, evalfuncs.getRoutingTableSize, test);
			this.nodes.select(3).eval(evalfuncs.getRoutingTable, test, function(rt) {
				test.ok('7111000000000000000000000000000000000002' === rt['0']['7'].id
						|| '7700000000000000000000000000000000000004' === rt['0']['7'].id);
				test.strictEqual('0000000000000000000000000000000000000000', rt['0']['0'].id);
				test.strictEqual('CCCC333EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE05', rt['4']['3'].id);
				test.strictEqual('CCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF13', rt['3']['F'].id);
				
				_this.nodes.done(test);
			});
		}
	})
};