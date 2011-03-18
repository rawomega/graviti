var sinon = require('sinon');
var bootstrapmgr = require('core/bootstrapmgr');
var langutil = require('common/langutil');
var node = require('core/node');
var leafset = require('core/leafset');
var routingmgr = require('core/routingmgr');
var testCase = require('nodeunit').testCase;

module.exports = {
	"bootstrap manager startup" : testCase({
		setUp : function(done) {
			node.nodeId = '1234';
			this.overlayCallback = { on : function() {}, sendToAddr : function() {} };
			this.on = sinon.collection.stub(this.overlayCallback, 'on');
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start bootstrap manager for node starting a new ring" : function(test) {			
			bootstrapmgr.start(this.overlayCallback);
			
			test.ok(this.on.calledWith('graviti-message-received', bootstrapmgr._handleReceivedGravitiMessage));
			test.ok(this.on.calledWith('graviti-message-forwarding', bootstrapmgr._handleForwardingGravitiMessage));
			test.done();
		},
		
		"bootstrap manager for node joining a ring should initiate sending of bootstrap requests" : function(test) {
			var sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			bootstrapmgr.pendingRequestCheckIntervalMsec = 50;
			
			bootstrapmgr.start(this.overlayCallback, '1.2.3.4:1234,5.6.7.8:5678,myhost:8888');
			
			test.ok(this.on.calledWith('graviti-message-received', bootstrapmgr._handleReceivedGravitiMessage));
			test.ok(this.on.calledWith('graviti-message-forwarding', bootstrapmgr._handleForwardingGravitiMessage));
			setTimeout(function() {
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {id : node.nodeId}, {method : 'GET'}, '1.2.3.4', '1234'));
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {id : node.nodeId}, {method : 'GET'}, '5.6.7.8', '5678'));
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {id : node.nodeId}, {method : 'GET'}, 'myhost', '8888'));
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
			
			leafset.reset();
			this.updateWithProvisional = sinon.collection.stub(leafset, 'updateWithProvisional');
			
			routingmgr.routingTable = {};
			this.updateRoutingTable = sinon.collection.stub(routingmgr, 'updateRoutingTable');
			
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {}, send : function() {}, sendToId : function() {} });
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			this.send = sinon.collection.stub(this.overlayCallback, 'send');
			this.sendToId = sinon.collection.stub(this.overlayCallback, 'sendToId');
			bootstrapmgr.overlayCallback = this.overlayCallback;
		
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			leafset.reset();
			routingmgr.routingTable = {};
			done();
		},
		
		"when we are nearest to joining node's node id, should respond with state tables directly and update our own state tables" : function(test) {			
			var msg = {
				uri : 'p2p:graviti/peers',
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
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
					leafset : leafset.compressedLeafset(),
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
			test.ok(this.updateWithProvisional.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.done();
		},
		
		"when we are not nearest to joining node's node id, should respond with state tables, rebroadcast request into ring, and update our own state tables" : function(test) {			
			sinon.collection.stub(leafset, 'isThisNodeNearestTo').returns(false);
			var msg = {
				uri : 'p2p:graviti/peers',
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
			test.strictEqual(this.sendToId.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToId.args[0][1], {
					id : 'ABCDEF',
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
			});
			test.deepEqual(this.sendToId.args[0][2], {method : 'GET'});
			test.strictEqual(this.sendToId.args[0][3], 'ABCDEF');
			
			// assert on response
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
				leafset : leafset.compressedLeafset(),
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
			test.ok(this.updateWithProvisional.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.done();
		},
		
		"when forwardig a bootstrap request, we should send our state tables to joining node" : function(test) {
			var msg = {
				uri : 'p2p:graviti/peers',
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
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
					leafset : leafset.compressedLeafset(),
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
			test.ok(this.updateWithProvisional.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '3.3.3.3:3333'));
			test.done();
		}
	}),

	"handling bootstrap responses" : testCase ({
		setUp : function(done) {
			var _this = this;
			node.nodeId = '1234';
			this.leafset = {'LS' : '5.5.5.5:5555'};
			this.routingTable = {'RT' : '5.5.5.5:5555'};
			this.msginfo = {
				sender_addr : '2.2.2.2',
				sender_port : 2222
			};
	
			this.updateWithProvisional = sinon.collection.stub(leafset, 'updateWithProvisional');
			this.updateWithKnownGood = sinon.collection.stub(leafset, 'updateWithKnownGood');
			this.updateRoutingTable = sinon.collection.stub(routingmgr, 'updateRoutingTable');
			this.mergeRoutingTable = sinon.collection.stub(routingmgr, 'mergeRoutingTable');
			
			this.leafsetPeers = [{ap:"1.1.1.1:1111"}, {ap:"2.2.2.2:2222"}];
			this.routingTablePeers = [{ap:"2.2.2.2:2222"}, {ap:"5.5.5.5:5555"}, {ap:"6.6.6.6:6666"}];
			this.leafsetEach = sinon.collection.stub(leafset, 'each', function(cbk) {
				while(_this.leafsetPeers.length > 0)
					cbk('someid', _this.leafsetPeers.shift());
			});
			this.routingTableEach = sinon.collection.stub(routingmgr, 'each', function(cbk) {
				while(_this.routingTablePeers.length > 0)
					cbk(_this.routingTablePeers.shift());
			});
	
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {}, send : function() {} });
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			bootstrapmgr.overlayCallback = this.overlayCallback;
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should update state tables on receiving a bootstrap response" : function(test) {
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'POST',
				content : {
					id : 'ABCDEF',
					leafset : _this.leafset,
					routing_table : _this.routingTable
				}
			};
					
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);
			
			test.ok(this.updateWithProvisional.calledWith(this.leafset));
			test.ok(this.mergeRoutingTable.calledWith(this.routingTable));
			test.ok(this.updateWithKnownGood.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.ok(this.updateRoutingTable.calledWith('ABCDEF', '2.2.2.2:2222'));
			test.done();
		},
		
		"should emit bootstrap complete event when last bootstrap response received" : function(test) {
			var bootstrapCompletedCalled = false;
			this.overlayCallback.on('bootstrap-completed', function() {bootstrapCompletedCalled = true;});
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/peers',
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
		},		
		
		"should notify peers in state tables when last bootstrap response received" : function(test) {
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/peers',
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
	
			test.ok(this.sendToAddr.callCount === 4);
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
						leafset : leafset.compressedLeafset(),
						routing_table : routingmgr.routingTable,
						id : node.nodeId
					}, { method : 'POST' }, '1.1.1.1', '1111'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				leafset : leafset.compressedLeafset(),
				routing_table : routingmgr.routingTable,
				id : node.nodeId
			}, { method : 'POST' }, '2.2.2.2', '2222'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				leafset : leafset.compressedLeafset(),
				routing_table : routingmgr.routingTable,
				id : node.nodeId
			}, { method : 'POST' }, '5.5.5.5', '5555'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				leafset : leafset.compressedLeafset(),
				routing_table : routingmgr.routingTable,
				id : node.nodeId
			}, { method : 'POST' }, '6.6.6.6', '6666'));
			test.done();
		}
	})
};