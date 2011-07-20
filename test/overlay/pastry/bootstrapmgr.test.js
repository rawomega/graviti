var sinon = require('sinon');
var assert = require('assert');
var bootstrapmgr = require('overlay/pastry/bootstrapmgr');
var messagemgr = require('messaging/messagemgr');
var langutil = require('common/langutil');
var node = require('core/node');
var leafset = require('overlay/pastry/leafset');
var routingtable = require('overlay/routingtable');
var testCase = require('nodeunit').testCase;
var heartbeater = require('overlay/pastry/heartbeater');
var pnsrunner = require('overlay/pastry/pnsrunner');
var mockutil = require('testability/mockutil');

module.exports = {
	"bootstrap manager startup" : testCase({
		setUp : function(done) {
			this.processOn = sinon.collection.stub(process, 'on');
			
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);
			this.pnsrunner = mockutil.stubProto(pnsrunner.PnsRunner);
			this.bootstrapmgr = new bootstrapmgr.BootstrapMgr(this.messagemgr, undefined, undefined, undefined, this.pnsrunner);
			
			node.nodeId = '1234567890123456789012345678901234567890';
			this.on = sinon.stub(this.messagemgr, 'on');
			done();
		},
		
		tearDown : function(done) {
			this.bootstrapmgr.stop();
			sinon.collection.restore();
			done();
		},
		
		"should set up exit hook on start" : function(test) {
			test.ok(this.processOn.calledWith('exit', this.bootstrapmgr.stop));
			test.done();
		},
		
		"should throw on startup when no completed callback given" : function(test) {			
			var _this = this;
			
			assert.throws(function() {
				_this.bootstrapmgr.start();
			}, /no bootstrap completed/i);			
			test.done();
		},
		
		"should start bootstrap manager for node starting a new ring" : function(test) {			
			this.bootstrapmgr.start('mybootstraps', sinon.stub());
			
			test.ok(this.on.calledWith('graviti-message-received'));
			test.ok(this.on.calledWith('graviti-message-forwarding'));
			test.done();
		},
		
		"bootstrap manager for node joining a ring should initiate sending of bootstrap requests without PNS when PNS off" : function(test) {
			var sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr');
			this.bootstrapmgr.pendingRequestCheckIntervalMsec = 50;
			this.bootstrapmgr.usePns = false;
			
			this.bootstrapmgr.start('1.2.3.4:1234,5.6.7.8:5678,myhost:8888', sinon.stub());
			
			test.ok(this.on.calledWith('graviti-message-received'));
			test.ok(this.on.calledWith('graviti-message-forwarding'));
			setTimeout(function() {
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, '1.2.3.4', '1234'));
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, '5.6.7.8', '5678'));
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, 'myhost', '8888'));
				test.done();
			}, 200);
		},
		
		"bootstrap manager for node joining a ring should initiate sending of bootstrap requests with PNS when PNS on" : function(test) {
			var sendToAddr = sinon.collection.stub(this.messagemgr, 'sendToAddr');
			this.bootstrapmgr.pendingRequestCheckIntervalMsec = 50;
			sinon.collection.stub(this.pnsrunner, 'run', function(endpoint, success) {
				success('6.6.6.6:6666');
			});
			
			this.bootstrapmgr.start('1.2.3.4:1234,5.6.7.8:5678,myhost:8888', sinon.stub());
			
			test.ok(this.on.calledWith('graviti-message-received'));
			test.ok(this.on.calledWith('graviti-message-forwarding'));
			setTimeout(function() {
				test.equal(3, sendToAddr.callCount);
				test.ok(sendToAddr.calledWith('p2p:graviti/peers', {joining_node_id : node.nodeId}, {method : 'GET'}, '6.6.6.6', '6666'));
				test.done();
			}, 200);
		},
		
		"bootstrap manager for node joining a ring should be able to re-send unacknowledged bootstrap requests" : function(test) {
			this.bootstrapmgr.pendingRequestCheckIntervalMsec = 50;
			this.bootstrapmgr.bootstrapRetryIntervalMsec = 50;
			this.bootstrapmgr.usePns = false;
			var callCount = 0;
			var sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr', function() {
				callCount++;
			});
			
			this.bootstrapmgr.start('1.2.3.4:1234,5.6.7.8:5678,myhost:8888', sinon.stub());
			
			setTimeout(function() {
				test.ok(callCount >= 6);
				test.done();
			}, 200);
		}
	}),

	"bootstrap manager shutdown" : testCase({
		setUp : function(done) {
			this.pnsrunner = mockutil.stubProto(pnsrunner.PnsRunner);
			this.cancelAll = sinon.collection.stub(this.pnsrunner, 'cancelAll');
			this.bootstrapmgr = new bootstrapmgr.BootstrapMgr(undefined, undefined, undefined, undefined, this.pnsrunner);
			done();
		},
		
		tearDown : function(done) {
			this.bootstrapmgr.stop();
			sinon.collection.restore();
			done();
		},
		
		"should stop pns on stop" : function(test) {
			this.bootstrapmgr.stop();
			
			test.ok(this.cancelAll.called);
			test.done();
		}
	}),

	"handling bootstrap requests" : testCase ({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.pnsrunner = mockutil.stubProto(pnsrunner.PnsRunner);
			this.bootstrapmgr = new bootstrapmgr.BootstrapMgr(this.messagemgr, this.leafset, this.routingtable, undefined, this.pnsrunner);
		
			node.nodeId = '1234567890123456789012345678901234567890';
			this.msginfo = {
				sender_ap : '2.2.2.2:2222'
			};
			this.sharedRow = {'2' : {'A' : {id :'00A'}}};
			
			this.updateWithProvisional = sinon.collection.stub(this.leafset, 'updateWithProvisional');
			
			this.rtUpdateWithKnownGood= sinon.stub(this.routingtable, 'updateWithKnownGood');
			this.getSharedRow = sinon.stub(this.routingtable, 'getSharedRow').returns(this.sharedRow);
			
			this.sendToAddr = sinon.collection.stub(this.messagemgr, 'sendToAddr');
			this.send = sinon.collection.stub(this.messagemgr, 'send');
			this.sendToId = sinon.collection.stub(this.messagemgr, 'sendToId');
		
			done();
		},
		
		tearDown : function(done) {
			this.bootstrapmgr.stop();
			sinon.collection.restore();
			done();
		},
		
		"when we are nearest to joining node's node id, should respond with final response" : function(test) {			
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'GET',
				content : {
					joining_node_id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234'					
				}
			};			
			
			this.bootstrapmgr.start('mybootstraps', sinon.stub);
			this.bootstrapmgr._handleReceivedGravitiMessage(msg, this.msginfo);

			test.ok(!this.send.called);
			test.ok(!this.sendToId.called);
			test.ok(this.sendToAddr.calledOnce);
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToAddr.args[0][1], 	{
					leafset : this.leafset.compressedLeafset(),
					routing_table : this.sharedRow,
					bootstrap_request_hops : ['1234567890123456789012345678901234567890'],
					last_bootstrap_hop : true
			});
			test.deepEqual(this.sendToAddr.args[0][2], {
					method : 'POST'
			});
			test.strictEqual(this.sendToAddr.args[0][3], '2.2.2.2');
			test.strictEqual(this.sendToAddr.args[0][4], '2222');
			test.done();
		},
		
		"when we are not nearest to joining node's node id, should rebroadcast request into ring" : function(test) {			
			sinon.stub(this.leafset, 'isThisNodeNearestTo').returns(false);
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'GET',
				content : {
					joining_node_id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234',
					bootstrap_source_ap : '3.3.3.3:3333'
				}
			};
			
			this.bootstrapmgr.start('', sinon.stub);
			this.bootstrapmgr._handleReceivedGravitiMessage(msg, this.msginfo);

			test.ok(!this.send.called);
			test.ok(!this.sendToAddr.called);
			test.ok(this.sendToId.calledOnce);
			test.strictEqual(this.sendToId.args[0][0], 'p2p:graviti/peers');
			test.deepEqual(this.sendToId.args[0][1], {
					joining_node_id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234',
					routing_table : this.sharedRow,
					bootstrap_request_hops : ['1234567890123456789012345678901234567890'],
					bootstrap_source_ap : '3.3.3.3:3333'
			});
			test.deepEqual(this.sendToId.args[0][2], {method : 'GET'});
			test.strictEqual(this.sendToId.args[0][3], 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234');
			test.done();
		},
		
		"when forwardig a bootstrap request, we should update partial routing table with our own" : function(test) {
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'GET',
				content : {
					joining_node_id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234',
					routing_table : {'1' : {'4' : {id :'040'}}},
					bootstrap_request_hops : ['BAAD'],
					bootstrap_source_ap : '3.3.3.3:3333'
				}
			};
				
			this.bootstrapmgr.start('', sinon.stub);
			this.bootstrapmgr._handleForwardingGravitiMessage(msg, this.msginfo);
			
			test.ok(!this.send.called);
			test.ok(!this.sendToId.called);
			test.ok(!this.sendToAddr.called);
			test.deepEqual(msg.content, {
				joining_node_id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234',
				routing_table : {
					'1' : {'4' : {id :'040'}},
					'2' : {'A' : {id :'00A'}}
				},
				bootstrap_request_hops : ['BAAD', '1234567890123456789012345678901234567890'],
				bootstrap_source_ap : '3.3.3.3:3333'
			});
			test.done();
		}
	}),

	"handling bootstrap responses" : testCase ({
		setUp : function(done) {
			var _this = this;
			
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = mockutil.stubProto(heartbeater.Heartbeater);
			this.pnsrunner = mockutil.stubProto(pnsrunner.PnsRunner);
			this.bootstrapmgr = new bootstrapmgr.BootstrapMgr(this.messagemgr, this.leafset, this.routingtable, this.heartbeater, this.pnsrunner);
			
			node.nodeId = '1234567890123456789012345678901234567890';
			this.leafsetContent = {'LS' : '5.5.5.5:5555'};
			this.routingTableContent = {'RT' : '5.5.5.5:5555'};
			this.msginfo = {
				sender_ap : '2.2.2.2:2222'
			};
	
			this.updateWithProvisional = sinon.stub(this.leafset, 'updateWithProvisional');
			this.updateWithKnownGood = sinon.stub(this.leafset, 'updateWithKnownGood');
			this.mergeProvisional = sinon.stub(this.routingtable, 'mergeProvisional');
			
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
			this.leafsetEach = sinon.stub(this.leafset, 'each', function(cbk) {
				for (var i = 0; i < _this.leafsetPeers.length; i++) {
					cbk('someid', _this.leafsetPeers[i]);
				}
			});
			this.routingTableEachRow = sinon.stub(this.routingtable, 'eachRow', function(cbk) {
				Object.keys(_this.routingTableRows).forEach(function(row) {					
					cbk(row, _this.routingTableRows[row]);					
				});
			});
	
			this.sendHeartbeatToAddr = sinon.collection.stub(this.heartbeater, 'sendHeartbeatToAddr');
			
			done();
		},
		
		tearDown : function(done) {
			this.bootstrapmgr.stop();
			sinon.collection.restore();
			done();
		},
		
		"should emit bootstrap complete event when last bootstrap response received" : function(test) {
			var bootstrapCompletedCallback = sinon.stub();
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'POST',
				source_id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234',
				content : {
					leafset : this.leafsetContent,
					routing_table : this.routingTableContent,
					last_bootstrap_hop : true
				}
			};
					
			this.bootstrapmgr.start('cool-bootstrap', bootstrapCompletedCallback);			
			this.bootstrapmgr._handleReceivedGravitiMessage(msg, this.msginfo);
			
			test.ok(!this.bootstrapmgr.bootstrapping);
			test.ok(bootstrapCompletedCallback.called);
			test.done();
		},		
		
		"should notify peers in state tables when last bootstrap response received" : function(test) {
			var _this = this;
			var msg = {
				uri : 'p2p:graviti/peers',
				method : 'POST',
				content : {
					id : 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234',
					leafset : this.leafsetContent,
					routing_table : this.routingTableContent,
					last_bootstrap_hop : true
				}
			};
			this.bootstrapmgr.bootstrapping = true;

			this.bootstrapmgr.start('mybootstrap', sinon.stub());
			this.bootstrapmgr._handleReceivedGravitiMessage(msg, this.msginfo);
	
			test.ok(this.sendHeartbeatToAddr.callCount === 4);
			test.ok(this.sendHeartbeatToAddr.calledWith ('1.1.1.1', '1111', {
				leafset : this.leafset.compressedLeafset()
			}));
			test.ok(this.sendHeartbeatToAddr.calledWith ('2.2.2.2', '2222', {
				leafset : this.leafset.compressedLeafset(),
				routing_table : { '0' : this.routingTableRows['0']}
			}));
			test.ok(this.sendHeartbeatToAddr.calledWith ('5.5.5.5', '5555', {
				routing_table : { '0' : this.routingTableRows['0']}
			}));
			test.ok(this.sendHeartbeatToAddr.calledWith ('6.6.6.6', '6666', {
				routing_table : { '1' : this.routingTableRows['1']}
			}));
			test.done();
		}
	})
};