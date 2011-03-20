var sinon = require('sinon');
var bootstrapmgr = require('core/bootstrapmgr');
var langutil = require('common/langutil');
var node = require('core/node');
var leafset = require('core/leafset');
var routingtable = require('core/routingtable');
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
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, '1.2.3.4', '1234'));
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, '5.6.7.8', '5678'));
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, 'myhost', '8888'));
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
			this.sharedRow = {'2' : {'A' : {id :'00A'}}};
			
			leafset.reset();
			this.updateWithProvisional = sinon.collection.stub(leafset, 'updateWithProvisional');
			
			routingtable.routingTable = {};
			this.updateRoutingTable = sinon.collection.stub(routingtable, 'updateRoutingTable');
			this.getSharedRow = sinon.collection.stub(routingtable, 'getSharedRow').returns(this.sharedRow);
			
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
			routingtable.routingTable = {};
			done();
		},
		
		"when we are nearest to joining node's node id, should respond with final response" : function(test) {			
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'GET',
				content : {
					joining_node_id : 'ABCDEF'					
				}
			};			
			
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);

			test.ok(!this.send.called);
			test.ok(!this.sendToId.called);
			test.ok(this.sendToAddr.calledOnce);
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
					leafset : leafset.compressedLeafset(),
					routing_table : this.sharedRow,
					bootstrap_request_hops : ['1234'],
					last_bootstrap_hop : true
			});
			test.deepEqual(this.sendToAddr.args[0][2], {
					method : 'POST'
			});
			test.strictEqual(this.sendToAddr.args[0][3], '2.2.2.2');
			test.strictEqual(this.sendToAddr.args[0][4], 	2222);
			test.done();
		},
		
		"when we are not nearest to joining node's node id, should rebroadcast request into ring" : function(test) {			
			sinon.collection.stub(leafset, 'isThisNodeNearestTo').returns(false);
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'GET',
				content : {
					joining_node_id : 'ABCDEF',
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
				}
			};
			
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-received", msg, this.msginfo);

			test.ok(!this.send.called);
			test.ok(!this.sendToAddr.called);
			test.ok(this.sendToId.calledOnce);
			test.strictEqual(this.sendToId.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToId.args[0][1], {
					joining_node_id : 'ABCDEF',
					routing_table : this.sharedRow,
					bootstrap_request_hops : ['1234'],
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
			});
			test.deepEqual(this.sendToId.args[0][2], {method : 'GET'});
			test.strictEqual(this.sendToId.args[0][3], 'ABCDEF');
			test.done();
		},
		
		"when forwardig a bootstrap request, we should update partial routing table with our own" : function(test) {
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'GET',
				content : {
					joining_node_id : 'ABCDEF',
					routing_table : {'1' : {'4' : {id :'040'}}},
					bootstrap_request_hops : ['BAAD'],
					bootstrap_source_addr : '3.3.3.3',
					bootstrap_source_port : 3333
				}
			};
				
			bootstrapmgr.start(this.overlayCallback);
			this.overlayCallback.emit("graviti-message-forwarding", msg, this.msginfo);
			
			test.ok(!this.send.called);
			test.ok(!this.sendToId.called);
			test.ok(!this.sendToAddr.called);
			test.deepEqual(msg.content, {
				joining_node_id : 'ABCDEF',
				routing_table : {
					'1' : {'4' : {id :'040'}},
					'2' : {'A' : {id :'00A'}}
				},
				bootstrap_request_hops : ['BAAD', '1234'],
				bootstrap_source_addr : '3.3.3.3',
				bootstrap_source_port : 3333
			});
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
			this.updateRoutingTable = sinon.collection.stub(routingtable, 'updateRoutingTable');
			this.mergeRoutingTable = sinon.collection.stub(routingtable, 'mergeRoutingTable');
			
			this.leafsetPeers = [{ap:"1.1.1.1:1111"}, {ap:"2.2.2.2:2222"}];
			this.routingTableRows = {
				'0' : { 
			    	'2' : {id : '2345', ap:"2.2.2.2:2222"},
			    	'5' : {id : '5678', ap:"5.5.5.5:5555"}
			    },
			    '1' : {
			    	'6' : {id : '6789', ap:"6.6.6.6:6666"}
			    }
			};
			this.leafsetEach = sinon.collection.stub(leafset, 'each', function(cbk) {
				for (var i = 0; i < _this.leafsetPeers.length; i++) {
					cbk('someid', _this.leafsetPeers[i]);
				}
			});
			this.routingTableEachRow = sinon.collection.stub(routingtable, 'eachRow', function(cbk) {
				Object.keys(_this.routingTableRows).forEach(function(row) {					
					cbk(row, _this.routingTableRows[row]);					
				});
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
		
		"should emit bootstrap complete event when last bootstrap response received" : function(test) {
			var bootstrapCompletedCalled = false;
			this.overlayCallback.on('bootstrap-completed', function() {bootstrapCompletedCalled = true;});
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'POST',
				source_id : 'ABCDEF',
				content : {
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
	
			test.ok(this.sendToAddr.callCount === 5);
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
						leafset : leafset.compressedLeafset()
					}, { method : 'POST' }, '1.1.1.1', '1111'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				leafset : leafset.compressedLeafset()
			}, { method : 'POST' }, '2.2.2.2', '2222'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				routing_table : { '0' : this.routingTableRows['0']}
			}, { method : 'POST' }, '2.2.2.2', '2222'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				routing_table : { '0' : this.routingTableRows['0']}
			}, { method : 'POST' }, '5.5.5.5', '5555'));
			test.ok(this.sendToAddr.calledWith ('p2p:graviti/peers', {
				routing_table : { '1' : this.routingTableRows['1']}
			}, { method : 'POST' }, '6.6.6.6', '6666'));
			test.done();
		}
	})
};