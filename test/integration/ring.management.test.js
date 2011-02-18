var util = require('util');
var spawn = require('child_process').spawn;
var langutil = require('common/langutil');
var evalclient = require('testability/evalclient');
var testCase = require('nodeunit').testCase;

var defaultConf = {
	num_nodes : 4,
	node_path : 'lib:apps',
	bind_addr : '127.0.0.1',
	base_port : 7100,
	base_test_port : 7200,
	test_timeout_msec : 10000,
	node_start_stagger_interval_msec : 200
}

function newNode(idx, startRing, conf) {
	var args = ['lib/main.js', '--port', conf.base_port +idx, '--test-mode', conf.base_test_port+idx];
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
	
//	setTimeout(function() {
//		util.log('Unexpectedly killing spawned node after ' + conf.test_timeout_msec + ' ms');
//		child.kill();
//	}, conf.test_timeout_msec);
	
	return child;
}

function newNodes(conf) {
	var children = [];
	children.push (newNode(0, true, conf));
	for (var i = 1; i < conf.num_nodes; i++) {
		// need new scope to access i from within closure
		setTimeout((function(idx) { return function() {
			children.push(newNode(idx, false, conf));						
		}})(i), conf.node_start_stagger_interval_msec * i);
	}
	return children;
}

function multiNodeTestCase(tests) {
	var testOpts = langutil.extend({}, defaultConf);
	for (var k in tests) {
		if (typeof (tests[k] !== 'function')) {
			testOpts[k] = tests[k];
		}
	}
	
	var nodeProcesses = undefined;
	var startNodes = function() {
		nodeProcesses = newNodes(testOpts);		
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
				if (nodeProcesses) {
					nodeProcesses.forEach(function(p) {
						p.kill();
					});					
				}
				
				if (tests.tearDown) {
					tests.tearDown(done);
				} else {
					done();
				}
			}
		});
	return testCase(multiNodeTests);
}

var waitPollingInterval = 1000;
var waitTimeout = 5000;
function waitUntilEqual(expected, func, idx, callback, waitedSoFar) {
	if (waitedSoFar !== undefined && (waitedSoFar > waitTimeout)) {
		callback(false, "Timed out");
		return;
	}
	
	var tryAgain = function() {
		setTimeout(function() {
			waitUntilEqual(expected, func, idx, callback, (waitedSoFar === undefined ? 0 : waitedSoFar) + waitPollingInterval);
		}, waitPollingInterval);
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

module.exports = {	
	"start and stop a multi-node ring" : multiNodeTestCase({
		num_nodes : 4,
		
		"set up a ring and populate leafset" : function(test) {
			waitUntilEqual( 3, function() {
					return Object.keys(require('core/leafsetmgr').leafset).length;
				},
				0, function(res, msg) {
					test.ok(res, msg);
					test.done();
				}
			);
		},
		
		"something else" : function(test) {
			test.done();
		}
	})
};