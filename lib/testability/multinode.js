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
	
	newNodes : function(conf) {
		var testNodes = [];
		var numNodes = conf.node_ids ? conf.node_ids.length : conf.num_nodes;
		
		var initialNode = new self.TestNode(0, conf);
		testNodes.push (initialNode);
		initialNode.start();
		
		for (var i = 1; i < numNodes; i++) {
			var bootstrappedNode = new self.TestNode(i, conf);
			bootstrappedNode.start();
			testNodes.push(bootstrappedNode);
		}
		return new self.TestNodes(testNodes);
	},
	
	TestNode : function(idx, conf) {
		// NOTE: when spawning multiple nodes as processes in quick succession, they
		// can end up with the same nodeid. For that reason we pre-generate node ids here,
		// from the same node process - that way they'll be different.
		var nodeId = conf.node_ids ? conf.node_ids[idx] : id.generateNodeId();		
		var args = ['lib/main.js', '--port', conf.base_port +idx, '--test-mode', conf.base_test_port+idx, '--nodeid', nodeId ];
		
		if (idx !== 0) {
			args.push('--bootstraps');
			args.push('localhost:' + conf.base_port);
		}		
		
		return {
			nodeId : nodeId,
			
			start : function() {
				util.log('STARTING PROCESS');
				var logFunc = function(data) {
					var str = new String(data).replace(/[\n\r]$/, '');
					str.split(/[\n\r]/).forEach(function(row) {
						console.log('[' + id.abbr(nodeId) + '] : ' + row);						
					});
				};
				this.process = spawn('node', args, langutil.extend(process.env, {
					NODE_PATH : conf.node_path
				}));
				this.process.stdout.on('data', function(data) {
					logFunc(data);
				});
				this.process.stderr.on('data', function(data) {
					logFunc(data);
				});
			},
			
			stop : function() {
				util.log('KILLING PROCESS');
				this.process.kill();
			},
			
			// eval content of given func on a node
			eval : function(func, callback, errCallback) {
				evalclient.eval(func, {
					port : conf.base_test_port + idx,
					success : function(res) {
						callback(res);
					},
					error : function(err) {
						errCallback(err.message);
					}
				});
			},
			
			//
			// wait until the value returned by func, executed by node number idx, reaches
			// the expected value - or until the timeout period is reached
			waitUntil : function(operator, expected, func, callback, errCallback, waitedSoFar) {
				if (waitedSoFar !== undefined && (waitedSoFar > conf.wait_timeout_msec)) {
					errCallback("Timed out waiting for given func to equal " + expected);
					return;
				}
				
				var _this = this;
				var tryAgain = function() {
					setTimeout(function() {
						_this.waitUntil(operator, expected, func, callback, errCallback,
								(waitedSoFar === undefined ? 0 : waitedSoFar) + conf.wait_polling_interval_msec);
					}, conf.wait_polling_interval_msec);
				};
				
				this.eval(func, function(res) {
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
			}
		}
	},
	
	TestNodes : function(nodes) {
		var _this = this;
		this.queue = [];
		this.nodes = nodes;
		this.currentNode = 0;
		this.interval = setInterval(function() {
			if (_this.queue.length > 0 && !_this.queue[0].running) {
				var currItem = _this.queue[0];
				var node = _this.nodes[currItem.nodeIndex];
				currItem.running = true;
				
				if (currItem.pre)
					currItem.pre();
				
				node[currItem.func].apply(node, currItem.args);
				if (currItem.isSync === true)
					_this.queue.shift();
			}
		}, 50);
		
		var numNodes = this.nodes.length;
		
		this.start = function() {
			_this._enqueue({
				nodeIndex : _this.currentNode,
				running : false,
				isSync : true,
				func : 'start',
				args : []
			});
		};
		
		this.stop = function() {
			_this._enqueue({
				nodeIndex : _this.currentNode,
				running : false,
				isSync : true,
				func : 'stop',
				args : [],
				pre : function() {
					console.log('\n\nNODES: ' + _this.nodes.length);
				}
			});
		};
		
		this.stopNow = function() {
			console.log('\n\nNODES: ' + _this.nodes.length);
			_this.nodes.forEach(function(tn) {
				tn.stop();
			});
		};
		
		this._enqueue = function(item) {
			if (_this.currentNode === 'all') {
				for (var i = 0; i < _this.nodes.length; i++) {
					var cloned = langutil.extend({}, item);
					cloned.nodeIndex = i;
					_this.queue.push(cloned);
				}
			} else if (toString.call(_this.currentNode) === '[object Array]') {
				for (var i in _this.currentNode) {
					var cloned = langutil.extend({}, item);
					cloned.nodeIndex = i;
					_this.queue.push(cloned);
				}
			} else {
				_this.queue.push(item);
			}
		};
		
		this.select = function(idx) {
			_this.currentNode = idx;
			return _this;
		};
		
		this.selectAll = function() {
			_this.currentNode = 'all';
			return _this;
		}
		
		this.done = function(test) {
			clearInterval(_this.interval);
			test.done();
		};
		
		this.eval = function(func, test, callback) {
			_this._enqueue({
				nodeIndex : _this.currentNode,
				running : false,
				func : 'eval',
				args : [func, function(res) {
					_this.queue.shift();
					if (callback)
						callback(res);
				}, function(msg) {
					test.fail(msg);
					_this.stopNow();
					test.done();
				}]
			});
		};
		
		this.waitUntilEqual = function(expected, func, test, callback, waitedSoFar) {
			this.waitUntil('deq', expected, func, test, callback, waitedSoFar);
		};
		
		this.waitUntilAtLeast = function(expected, func, test, callback, waitedSoFar) {
			this.waitUntil('ge', expected, func, test, callback, waitedSoFar);
		};
		
		this.waitUntilAtMost = function(expected, func, test, callback, waitedSoFar) {
			this.waitUntil('le', expected, func, test, callback, waitedSoFar);
		};
		
		this.waitUntil = function(operator, expected, func, test, callback, waitedSoFar) {
			_this._enqueue({
				nodeIndex : _this.currentNode,
				running : false,
				func : 'waitUntil',
				args : [operator, expected, func, function() {
					_this.queue.shift();
					if (callback)
						callback();
				}, function(msg) {
					test.fail(msg);
					_this.stopNow();
					test.done();
				}]
			});
		};
	}	
};