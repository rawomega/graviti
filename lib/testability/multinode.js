var util = require('util');
var assert = require('assert');
var spawn = require('child_process').spawn;
var langutil = require('common/langutil');
var evalclient = require('testability/evalclient');
var nodeunit = require('nodeunit');
var id = require('common/id');

var defaultConf = {
	num_nodes : 4,
	node_path : 'lib:apps',
	bind_addr : '127.0.0.1',
	base_port : 7100,
	base_test_port : 7200,
	test_timeout_msec : 10000,
	node_start_stagger_interval_msec : 200,
	wait_polling_interval_msec : 1000,
	wait_timeout_msec : 5000
};

var self = module.exports = {
	start : function(opts) {
		var defConf = langutil.extend({}, defaultConf);
		var conf = langutil.extend(defConf, opts);
		
		return self.newNodes(conf);
	},
	
	stop : function(testNodes) {
		if (testNodes) {
			testNodes.forEach(function(tn) {
				tn.process.kill();
			});					
		}
	},
		
	TestNode : function(idx, conf) {
		var nodeId = conf.node_ids ? conf.node_ids[idx] : id.generateNodeId();		
		var args = ['lib/main.js', '--port', conf.base_port +idx, '--test-mode', conf.base_test_port+idx, '--nodeid', nodeId ];
		
		if (idx !== 0) {
			args.push('--bootstraps');
			args.push('localhost:' + conf.base_port);
		}
		var child = spawn('node', args, langutil.extend(process.env, {
			NODE_PATH : conf.node_path
		}));
		child.stdout.on('data', function(data) {
			 util.log('[chld:out] : ' + new String(data).replace(/[\n\r]$/, ''));
		});
		child.stderr.on('data', function(data) {
			util.log('[chld:err] : ' + new String(data).replace(/[\n\r]$/, ''));
		});

		return {
			process : child,
			nodeId : nodeId,		
			
			// eval content of given func on a node
			eval : function(func, test, callback, errCallback) {
				evalclient.eval(func, {
					port : conf.base_test_port + idx,
					success : function(res) {
						callback(res);
					},
					error : function(err) {
						if (errCallback)
							errCallback(err);
						else
							test.fail(err.message);
					}
				});
			},
			
			//
			// wait until the value returned by func, executed by node number idx, reaches
			// the expected value - or until the timeout period is reached
			waitUntilEqual : function(expected, func, test, callback, waitedSoFar) {
				if (waitedSoFar !== undefined && (waitedSoFar > conf.wait_timeout_msec)) {
					test.fail("Timed out");
					return;
				}
				
				var _this = this;
				var tryAgain = function() {
					setTimeout(function() {
						_this.waitUntilEqual(expected, func, test, callback,
								(waitedSoFar === undefined ? 0 : waitedSoFar) + conf.wait_polling_interval_msec);
					}, conf.wait_polling_interval_msec);
				};
				
				this.eval(func, test, function(res) {
						try {
							assert.deepEqual(expected, res);
						} catch (e) {
							tryAgain();
							return;
						}
						callback();
					}, function(err) {
						if (err.message.indexOf('ECONNREFUSED') == 0) {
							tryAgain();
						} else {
							test.fail('Remote eval error : ' + (err && err.message ? err.message : err));					
						}				
					}
				);
			}
		}
	},

	newNodes : function(conf) {
		var testNodes = [];
		var numNodes = conf.node_ids ? conf.node_ids.length : conf.num_nodes;
		testNodes.push (new self.TestNode(0, conf));
		for (var i = 1; i < numNodes; i++) {
			// need new scope to access i from within closure
			setTimeout((function(idx) { return function() {
				testNodes.push(new self.TestNode(idx, conf));						
			}})(i), conf.node_start_stagger_interval_msec * i);
		}
		return testNodes;
	}
};