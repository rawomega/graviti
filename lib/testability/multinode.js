var util = require('util');
var spawn = require('child_process').spawn;
var langutil = require('common/langutil');
var evalclient = require('testability/evalclient');
var nodeunit = require('nodeunit');

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
	testCase : function(tests) {
		var testOpts = langutil.extend({}, defaultConf);
		for (var k in tests) {
			if (typeof (tests[k] !== 'function')) {
				testOpts[k] = tests[k];
			}
		}
		
		var childProcesses = undefined;
		var startNodes = function() {
			childProcesses = self.newNodes(testOpts);		
		};
		
		var multiNodeTests = langutil.extend(
			langutil.extend({}, tests), {
				setUp : function(done) {
					if (tests.setUp) {
						tests.setUp(function() {
							startNodes();
							done();
						});
					} else {
						startNodes();
						done();
					}
				},
				
				tearDown : function(done) {
					if (childProcesses) {
						childProcesses.forEach(function(p) {
							p.kill();
						});					
					}
					
					if (tests.tearDown) {
						tests.tearDown(done);
					} else {
						done();
					}
				}
			}
		);
		return nodeunit.testCase(multiNodeTests);
	},
		
	newNode : function(idx, startRing, conf) {
		var args = ['lib/main.js', '--port', conf.base_port +idx, '--test-mode', conf.base_test_port+idx];
		if (conf.node_ids) {
			args.push('--nodeid');
			args.push(conf.node_ids[idx]);
		}
		if (!startRing) {
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

		return child;
	},

	newNodes : function(conf) {
		var childProcesses = [];
		var numNodes = conf.node_ids ? conf.node_ids.length : conf.num_nodes;
		childProcesses.push (self.newNode(0, true, conf));
		for (var i = 1; i < numNodes; i++) {
			// need new scope to access i from within closure
			setTimeout((function(idx) { return function() {
				childProcesses.push(self.newNode(idx, false, conf));						
			}})(i), conf.node_start_stagger_interval_msec * i);
		}
		return childProcesses;
	},		

	//
	// wait until the value returned by func, executed by node number idx, reaches
	// the expected value - or until the timeout period is reached
	waitUntilEqual : function(expected, func, idx, callback, waitedSoFar) {
		if (waitedSoFar !== undefined && (waitedSoFar > defaultConf.wait_timeout_msec)) {
			callback(false, "Timed out");
			return;
		}
		
		var tryAgain = function() {
			setTimeout(function() {
				self.waitUntilEqual(expected, func, idx, callback,
						(waitedSoFar === undefined ? 0 : waitedSoFar) + defaultConf.wait_polling_interval_msec);
			}, defaultConf.wait_polling_interval_msec);
		};
		
		evalclient.eval(
			func,
			{
				port : defaultConf.base_test_port + idx,
				success : function(res) {
					if (res === expected) {
						callback(true);					
					} else {
						tryAgain();
					}
				},
				error : function(err) {
					if (err.message.indexOf('ECONNREFUSED') == 0) {
						tryAgain();
					} else {
						callback(false, 'Remote eval error : ' + (err && err.message ? err.message : err));					
					}
				}
			}
		);
	}
};