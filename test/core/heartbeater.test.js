var sinon = require('sinon');
var heartbeater = require('core/heartbeater');
var leafsetmgr = require('core/leafsetmgr');
var routingmgr = require('core/routingmgr');
var testCase = require('nodeunit').testCase;

module.exports = {
	"startup" : testCase({
		setUp : function(done) {
			this.overlayCallback = { on : function() {}, sendToAddr : function() {} };
			this.on = sinon.collection.stub(this.overlayCallback, 'on');
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			
			leafsetmgr.leafset = {};			
			routingmgr.routingTable = {};
			
			done();
		},
		
		tearDown : function(done) {
			heartbeater.stop();
			sinon.collection.restore();
			done();
		},
		
		"should set up received message listening when starting heartbeater" : function(test) {			
			heartbeater.start(this.overlayCallback);
			
			test.ok(this.on.calledWith('graviti-message-received', heartbeater._handleReceivedGravitiMessage));
			test.done();
		},
		
		"should send heartbeat to leafset nodes shortly after startup" : function(test) {
			var _this = this;
			leafsetmgr.leafset = {
					'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123' : '127.0.0.1:8888',
					'1234567890123456789012345678901234567890' : '127.0.0.1:9999'
			};
			heartbeater.heartbeatIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			setTimeout(function() {
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
						leafset : leafsetmgr.leafset,
						routing_table : routingmgr.routingTable
					});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[0][4], '8888');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
						leafset : leafsetmgr.leafset,
						routing_table : routingmgr.routingTable
					});
				test.deepEqual(_this.sendToAddr.args[1][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[1][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[1][4], '9999');
				test.done();
			}, 200);
		}
	}),

	"stopping" : testCase({
		setUp : function(done) {
			leafsetmgr.leafset = {'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123' : '127.0.0.1:8888'};
			
			this.overlayCallback = { sendToAddr : function() {}, on : function() {} };
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			
			done();
		},
		
		tearDown : function(done) {
			leafsetmgr.leafset = {};
			sinon.collection.restore();
			done();
		},
		
		"should not invoke message sender after stopping" : function(test) {
			var _this = this;
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.start(this.overlayCallback);
			
			heartbeater.stop();
			
			setTimeout(function() {
				test.ok(_this.sendToAddr.callCount < 2);
				test.done();
			}, 300);
		}
	}),
	
	"handling received heartbeats" : testCase({
		setUp : function(done) {
			this.msg = {
				uri : 'p2p:graviti/heartbeat',
				method : 'POST',
				content : {
					leafset : {a:'b'},
					routing_table : {c : 'd'}
				}
			}
		
			this.updateLeafset = sinon.collection.stub(leafsetmgr, 'updateLeafset');
			this.mergeRoutingTable = sinon.collection.stub(routingmgr, 'mergeRoutingTable');
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"update leafset and routing table on receipt" : function(test) {
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.updateLeafset.calledWith({a:'b'}));
			test.ok(this.mergeRoutingTable.calledWith({c:'d'}));
			test.done();
		}
	})
};