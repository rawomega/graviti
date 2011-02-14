var sinon = require('sinon');
var bootstrapmgr = require('../../lib/core/bootstrapmgr');
var langutil = require('../../lib/common/langutil');
var node = require('../../lib/core/node');
var leafsetmgr = require('../../lib/core/leafsetmgr');
var routingmgr = require('../../lib/core/routingmgr');
var testCase = require('nodeunit').testCase;

module.exports = {
	"bootstrap manager startup" : testCase({
		setUp : function(done) {
			node.nodeId = '1234';
			this.overlayCallback = { on : function() {}, sendToAddr : function() {} };
			this.on = sinon.stub(this.overlayCallback, 'on');
			
			done();
		},
		
		"should start bootstrap manager for node starting a new ring" : function(test) {			
			bootstrapmgr.start(this.overlayCallback);
			
			test.ok(this.on.calledWith('graviti-message-received', bootstrapmgr._handleReceivedGravitiMessage));
			test.ok(this.on.calledWith('graviti-message-forwarding', bootstrapmgr._handleForwardingGravitiMessage));
			test.done();
		},
		
		"bootstrap manager for node joining a ring should initiate sending of bootstrap requests" : function(test) {
			var sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			bootstrapmgr.pendingRequestCheckIntervalMsec = 50;
			
			bootstrapmgr.start(this.overlayCallback, '1.2.3.4:1234,5.6.7.8:5678,myhost:8888');
			
			test.ok(this.on.calledWith('graviti-message-received', bootstrapmgr._handleReceivedGravitiMessage));
			test.ok(this.on.calledWith('graviti-message-forwarding', bootstrapmgr._handleForwardingGravitiMessage));
			setTimeout(function() {
				test.ok(sendToAddr.calledWith('p2p:graviti/statetables', {id : node.nodeId}, {method : 'GET'}, '1.2.3.4', '1234'));
				test.ok(sendToAddr.calledWith('p2p:graviti/statetables', {id : node.nodeId}, {method : 'GET'}, '5.6.7.8', '5678'));
				test.ok(sendToAddr.calledWith('p2p:graviti/statetables', {id : node.nodeId}, {method : 'GET'}, 'myhost', '8888'));
				test.done();
			}, 200);
		},
		
		"bootstrap manager for node joining a ring should be able to re-send unacknowledged bootstrap requests" : function(test) {
			bootstrapmgr.pendingRequestCheckIntervalMsec = 50;
			bootstrapmgr.bootstrapRetryIntervalMsec = 50;
			var callCount = 0;
			var sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr', function() {
				callCount++;
			});
			
			bootstrapmgr.start(this.overlayCallback, '1.2.3.4:1234,5.6.7.8:5678,myhost:8888');
			
			setTimeout(function() {
				test.ok(callCount >= 6);
				test.done();
			}, 200);
		}
	}),
	
	"handling bootstrap requests" : testCase ({
		setUp : function(done) {
			node.nodeId = '1234';
			this.msginfo = {
				sender_addr : '2.2.2.2',
				sender_port : 2222
			};
			
			leafsetmgr.leafset = {};
			leafsetmgr.updateLeafset = function() {};
			this.updateLeafset = sinon.stub(leafsetmgr, 'updateLeafset');
			
			routingmgr.routingTable = {};
			routingmgr.updateRoutingTable = function() {};
			this.updateRoutingTable = sinon.stub(routingmgr, 'updateRoutingTable');
			
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {}, send : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			this.send = sinon.stub(this.overlayCallback, 'send');
			bootstrapmgr.overlayCallback = this.overlayCallback;
		
			done();
		},
		
		"when we are nearest to joining node's node id, should respond with state tables directly and update our own state tables" : function(test) {			
			var msg = {
				uri : 'p2p:graviti/statetables',
				method : 'GET',
				content : {
					id : 'ABCDEF'					
				}
			};
			
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);

			// assert no call to send
			test.ok(!this.send.called);
			// assert on response
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/statetables');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
					leafset : leafsetmgr.leafset,
					routing_table : routingmgr.routingTable,
					id : node.nodeId,
					bootstrap_source_addr : '2.2.2.2',
					bootstrap_source_port : 2222,
					last_bootstrap_hop : true
			});
			test.deepEqual(this.sendToAddr.args[0][2], {
					method : 'POST'
			});
			test.strictEqual(this.sendToAddr.args[0][3], '2.2.2.2');
			test.strictEqual(this.sendToAddr.args[0][4], 	2222);
			// assert on state table updates
			test.ok(this.updateLeafset.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.done();
		},
		
		"when we are not nearest to joining node's node id, should respond with state tables, rebroadcast request into ring, and update our own state tables" : function(test) {			
			leafsetmgr.leafset = {'AAAAAA' : '4.4.4.4:4444'};
			var msg = {
				uri : 'p2p:graviti/statetables',
				method : 'GET',
				content : {
					id : 'ABCDEF',
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
				}
			};
			
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);

			// assert on rebroadcast
			test.strictEqual(this.send.args[0][0], 'p2p:graviti/statetables');
			test.deepEqual(this.send.args[0][1], {
					id : 'ABCDEF',
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
			});
			test.deepEqual(this.send.args[0][2], {
					method : 'GET',
					dest_id : 'ABCDEF'
			});
			// assert on response
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/statetables');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
				leafset : leafsetmgr.leafset,
				routing_table : routingmgr.routingTable,
				id : node.nodeId,
				bootstrap_source_addr : '3.3.3.3',
				bootstrap_source_port : 3333
			});
			test.deepEqual(this.sendToAddr.args[0][2], {
					method : 'POST'
			});
			test.strictEqual(this.sendToAddr.args[0][3], '3.3.3.3');
			test.strictEqual(this.sendToAddr.args[0][4], 3333);
			// assert on state table updates
			test.ok(this.updateLeafset.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.done();
		},
		
		"when forwardig a bootstrap request, we should send our state tables to joining node" : function(test) {
			var msg = {
				uri : 'p2p:graviti/statetables',
				method : 'GET',
				content : {
					id : 'ABCDEF',
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
				}
			};
				
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-forwarding", msg, this.msginfo);
			
			// assert no call to send
			test.ok(!this.send.called);
			// assert on response
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/statetables');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
					leafset : leafsetmgr.leafset,
					routing_table : routingmgr.routingTable,
					id : node.nodeId,
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333,
					last_bootstrap_hop : true
			});
			test.deepEqual(this.sendToAddr.args[0][2], {
					method : 'POST'
			});
			test.strictEqual(this.sendToAddr.args[0][3], '3.3.3.3');
			test.strictEqual(this.sendToAddr.args[0][4], 3333);
			// assert on state table updates
			test.ok(this.updateLeafset.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.done();
		}
	}),
	
	"handling bootstrap responses" : testCase ({
		setUp : function(done) {
			node.nodeId = '1234';
			this.leafset = {'LS' : '5.5.5.5:5555'};
			this.routingTable = {'RT' : '5.5.5.5:5555'};
			this.msginfo = {
				sender_addr : '2.2.2.2',
				sender_port : 2222
			};
	
			leafsetmgr.updateLeafset = function() {};
			this.updateLeafset = sinon.stub(leafsetmgr, 'updateLeafset');
			
			routingmgr.updateRoutingTable = function() {};
			routingmgr.mergeRoutingTable = function() {};
			this.updateRoutingTable = sinon.stub(routingmgr, 'updateRoutingTable');
			this.mergeRoutingTable = sinon.stub(routingmgr, 'mergeRoutingTable');
	
			this.overlayCallback = new events.EventEmitter();
			bootstrapmgr.overlayCallback = this.overlayCallback;
			
			done();
		},
		
		"should update state tables on receiving a bootstrap response" : function(test) {
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/statetables',
				method : 'POST',
				content : {
					id : 'ABCDEF',
					leafset : _this.leafset,
					routing_table : _this.routingTable
				}
			};
					
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);
			
			test.ok(this.updateLeafset.calledWith(this.leafset));
			test.ok(this.mergeRoutingTable.calledWith(this.routingTable));
			test.ok(this.updateLeafset.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.done();
		},
		
		"should emit bootstrap complete event when last bootstrap response received" : function(test) {
			var bootstrapCompletedCalled = false;
			this.overlayCallback.on('bootstrap-completed', function() {bootstrapCompletedCalled = true;});
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/statetables',
				method : 'POST',
				content : {
					id : 'ABCDEF',
					leafset : _this.leafset,
					routing_table : _this.routingTable,
					last_bootstrap_hop : true
				}
			};
					
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);
			
			test.ok(!bootstrapmgr.bootstrapping);
			test.ok(bootstrapCompletedCalled);
			test.done();
		}
	})
};