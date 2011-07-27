var logger = require('logmgr').getLogger('testing');
var assert = require('assert');
var langutil = require('langutil');
var nodeunit = require('nodeunit');
var ringutil = require('ringutil');
var pastry = require('pastry');

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

exports.createTestRing = function(opts) {
	var defConf = langutil.extend({}, defaultConf);
	var conf = langutil.extend(defConf, opts);

	var testNodes = [];
	var numNodes = conf.node_ids ? conf.node_ids.length : conf.num_nodes;
	
	for (var i = 0; i < numNodes; i++) {
		var nodeId = conf.node_ids ? conf.node_ids[i] : ringutil.generateNodeId();	
		pastry.createNode(nodeId, conf.base_port+i, '127.0.0.1', function(node) {			
			if (node.transport.udptran.port === conf.base_port)
				node.startRing();	
			else
				node.joinRing('localhost:' + conf.base_port);
			testNodes.push(node);
			
			node.eval = function(func, success, error) {
				var res = func(node);
				logger.info('[' + node.transport.udptran.port + ']: eval res: ' + res + ' for ' + func.toString());
				success(res);
			};
			
			//// wait until the value returned by func, executed by node number idx, reaches
			//// the expected value - or until the timeout period is reached
			node.waitUntil = function(operator, expected, func, callback, errCallback, waitedSoFar) {
				if (waitedSoFar !== undefined && (waitedSoFar > conf.wait_timeout_msec)) {
					errCallback("Timed out waiting for given func on node " + node.transport.udptran.port + " to equal " + expected);
					return;
				}
				
				var _this = this;
				var tryAgain = function() {
					setTimeout(function() {
						_this.waitUntil(operator, expected, func, callback, errCallback,
								(waitedSoFar === undefined ? 0 : waitedSoFar) + conf.wait_polling_interval_msec);
					}, conf.wait_polling_interval_msec);
				};
				
				this.eval(
					func,
					function(res) {
						try {
							if (operator === 'deq')
								assert.deepEqual(expected, res);
							else if (operator === 'eq')
								assert.strictEqual(expected, res);
							else if (operator === 'gt')
								assert.ok(res > expected);
							else if (operator === 'ge')
								assert.ok(res >= expected);
							else if (operator === 'lt')
								assert.ok(res < expected);
							else if (operator === 'le')
								assert.ok(res > expected);
							else {
								errCallback('UNEXPECTED OPERATOR: ' + operator);
								return;
							}
						} catch (e) {
							tryAgain();
							return;
						}
						if (callback)
							callback();
					}, function(errMsg) {
						if (errMsg.indexOf('ECONNREFUSED') == 0) {
							tryAgain();
						} else {
							errCallback('Remote eval error : ' + errMsg);					
						}				
					}
				);
			};

			if (testNodes.length === numNodes) {
				var ring = new TestRing(testNodes);
				opts.success(ring);
			}
		});
	}
};

function TestRing(nodes) {
	var self = this;
	this.queue = [];
	this.currentNode = 0;
	this.nodes = nodes;		
	
	this.nodeIds = [];
	for (var n in nodes)
		this.nodeIds.push(nodes[n].nodeId);
	
	this.interval = setInterval(function() {
		if (self.queue.length > 0 && !self.queue[0].running) {
			var currItem = self.queue[0];
			var node = self.nodes[currItem.nodeIndex];
			currItem.running = true;
			
			if (currItem.pre)
				currItem.pre();
			
			node[currItem.func].apply(node, currItem.args);
			if (currItem.isSync === true)
				self.queue.shift();
		}
	}, 50);
}
exports.TestRing = TestRing;
	
TestRing.prototype.stop = function() {
	this._enqueue({
		nodeIndex : this.currentNode,
		running : false,
		isSync : true,
		func : 'stop',
		args : [],
		pre : function() {
			console.log('\n\nNODES: ' + this.nodes.length);
		}
	});
};
	
TestRing.prototype.stopNow = function() {
	console.log('\n\nNODES: ' + this.nodes.length);
	this.nodes.forEach(function(tn) {
		tn.stop();
	});
};
	
TestRing.prototype._enqueue = function(item) {
	if (this.currentNode === 'all') {
		for (var i = 0; i < this.nodes.length; i++) {
			var cloned = langutil.extend({}, item);
			cloned.nodeIndex = i;
			this.queue.push(cloned);
		}
	} else if (toString.call(this.currentNode) === '[object Array]') {
		for (var idx in this.currentNode) {
			var clone = langutil.extend({}, item);
			clone.nodeIndex = idx;
			this.queue.push(clone);
		}
	} else {
		this.queue.push(item);
	}
};
	
TestRing.prototype.select = function(idx) {
	this.currentNode = idx;
	return this;
};
	
TestRing.prototype.selectAll = function() {
	this.currentNode = 'all';
	return this;
};

TestRing.prototype.done = function(test) {
	clearInterval(this.interval);
	test.done();
};

TestRing.prototype.eval = function(func, test, callback) {
	var self = this;
	this._enqueue({
		nodeIndex : this.currentNode,
		running : false,
		func : 'eval',
		args : [func,
			function(res) {
				self.queue.shift();
				if (callback)
					callback(res);
			},
			function(msg) {
				test.fail(msg);
				self.stopNow();
				test.done();
			}]
	});
};

TestRing.prototype.waitUntilEqual = function(expected, func, test, callback, waitedSoFar) {
	this.waitUntil('deq', expected, func, test, callback, waitedSoFar);
};

TestRing.prototype.waitUntilAtLeast = function(expected, func, test, callback, waitedSoFar) {
	this.waitUntil('ge', expected, func, test, callback, waitedSoFar);
};

TestRing.prototype.waitUntilAtMost = function(expected, func, test, callback, waitedSoFar) {
	this.waitUntil('le', expected, func, test, callback, waitedSoFar);
};

TestRing.prototype.waitUntil = function(operator, expected, func, test, callback, waitedSoFar) {
	var self = this;
	this._enqueue({
		nodeIndex : this.currentNode,
		running : false,
		func : 'waitUntil',
		args : [operator, expected, func, function() {
			self.queue.shift();
			if (callback)
				callback();
		}, function(msg) {
			test.fail(msg);
			self.stopNow();
			test.done();
		}]
	});
};
//// eval content of given func on a node
//eval = function(func, callback, errCallback) {
//	evalclient.eval(func, {
//		port : conf.base_test_port + idx,
//		success = function(res) {
//			callback(res);
//		},
//		error = function(err) {
//			errCallback(err.message);
//		}
//	});
//},
//