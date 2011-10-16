var logger = require('logmgr').getDefaultLogger();
var testing = require('testing');
var nodeunit = require('nodeunit');
var evalfuncs = require('./evalfuncs');

module.exports = {
	"proximity neighbor selection" : nodeunit.testCase({
		setUp : function(done) {
			var self = this;
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
			
            // this.delaySendsByPortDistance = function() {
            //     var transportmgr = require('messaging/transportmgr');
            //     var oldSendFunc = transportmgr.send;
				
            //     require('util').log('TEST: Adding a delay to all sends that is proportional to distance');
            //     transportmgr.send = function(port, host, data) {
            //         var dist = Math.abs(transportmgr.port - port);
					
            //         setTimeout(function() {
            //             oldSendFunc(port, host, data);
            //         }, 60 * dist);
            //     };
            // };
			
			testing.createRing({
				node_ids : this.nodeIds,
				wait_timeout_msec : 60000,
                nodeCreated : function(node) {
                    //node.eval(self.delaySendsByPortDistance);
                    var oldSendFunc = node.transport.sendMessage.bind(node.transport);
                    logger.info('TEST: Adding a delay to all sends that is proportional to distance');
                    node.transport.sendMessage = function(port, host, msg) {
                        var dist = Math.abs(node.port - port);
                        setTimeout(function() {
                            oldSendFunc(port, host, msg);
                        }, 60 * dist);
                    };
                },
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

		"prefer closer peers" : function(test) {
            var self = this;
			
			// wait till leafset is sorted
			this.ring.select(0).waitUntilAtLeast(this.nodeIds.length-1, evalfuncs.getLeafsetSize, test);			
			this.ring.select(this.nodeIds.length-1).waitUntilAtLeast(this.nodeIds.length-1, evalfuncs.getLeafsetSize, test);
			
			// ensure close peers are preferred for node starting with 0 - these
			// are all row 0 peers 
			this.ring.select(0).waitUntilAtLeast(3, evalfuncs.getRoutingTableSize, test);
			this.ring.select(0).eval(evalfuncs.getRoutingTable, test, function(rt) {
				test.strictEqual('4400000000000000000000000000000000000001', rt['0']['4'].id);
				test.strictEqual('7111000000000000000000000000000000000002', rt['0']['7'].id);
				test.strictEqual('CCCC000000000000000000000000000000000003', rt['0']['C'].id);
			});
			
			// ensure close peers are preferred for node 3 - here we have a mix of row 0
			// peers and deeper peers
			this.ring.select(3).waitUntilAtLeast(5, evalfuncs.getRoutingTableSize, test);
			this.ring.select(3).eval(evalfuncs.getRoutingTable, test, function(rt) {
				test.ok('7111000000000000000000000000000000000002' === rt['0']['7'].id
						|| '7700000000000000000000000000000000000004' === rt['0']['7'].id);
				test.strictEqual('0000000000000000000000000000000000000000', rt['0']['0'].id);
				test.strictEqual('CCCC333EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE05', rt['4']['3'].id);
				test.strictEqual('CCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF13', rt['3']['F'].id);
				
				self.ring.done(test);
			});
		}
	})
};