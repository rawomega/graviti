var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var node = require('core/node');
var transportmgr = require('messaging/transportmgr');
var messagemgr = require('messaging/messagemgr');
var mockutil = require('testability/mockutil');
var uri = require('common/uri');

module.exports = {
	"creation" : testCase({
		setUp : function(done) {
			this.transportmgr = mockutil.stubProto(transportmgr.TransportMgr);
			this.transportmgrOn = sinon.stub(this.transportmgr, 'on');
			this.messagemgr = new messagemgr.MessageMgr(this.transportmgr);
						
			done();
		},
	
		"should listen to messages" : function(test) {
			test.strictEqual(this.transportmgrOn.args[0][0], 'message');
			test.strictEqual('function', typeof(this.transportmgrOn.args[0][1]));
			test.done();
		}
	}),
	
	"sending messages" : testCase({
		setUp : function(done) {
			this.router = { getNextHop : function() {} };
			this.transportmgr = mockutil.stubProto(transportmgr.TransportMgr);
			this.messagemgr = new messagemgr.MessageMgr(this.transportmgr);
			this.messagemgr.router = this.router;
			
			node.nodeId = 'ABCD';
			sinon.collection.stub(Date, 'now').returns(12345678);
			this.nextHop = {
					id : 'CDEF',
					addr : '5.5.5.5',
					port : 5555
				};
			sinon.stub(this.router, 'getNextHop').returns(this.nextHop);
			
			this.uri = 'p2p:myapp/myresource';
			this.content = {my : 'content'};
			this.send = sinon.stub(this.transportmgr, 'send');
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.msginfo = {
					app_name : 'myapp',
					next_hop_id : 'CDEF',
					next_hop_addr : '5.5.5.5',
					next_hop_port : 5555
			};

			this.messagemgr.on('myapp-app-message-forwarding', this.appForwarding);
			this.messagemgr.on('myapp-app-message-received', this.appReceived);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"be able to send a message to a uri mapping to a remote node" : function(test) {
			var destId = uri.parse(this.uri).hash;
			
			this.messagemgr.send(this.uri, this.content, {method : 'POST'});
			
			test.strictEqual(this.send.args[0][0], 5555);			
			test.strictEqual(this.send.args[0][1], '5.5.5.5');
			test.strictEqual(this.send.args[0][2].uri, this.uri);
			test.strictEqual(this.send.args[0][2].dest_id, destId);
			test.strictEqual(this.send.args[0][2].method, 'POST');
			test.deepEqual(this.send.args[0][2].content, this.content);
			test.deepEqual(this.appForwarding.args[0][0], this.send.args[0][2]);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.done();
		},
		
		"be able to send a message to a uri mapping to the current node" : function(test) {
			var destId =  uri.parse(this.uri).hash;
			this.nextHop.id = node.nodeId;
			
			this.messagemgr.send(this.uri, this.content, {method : 'POST'});
						
			test.ok(!this.send.called);
			test.ok(!this.appForwarding.called);
			test.strictEqual(this.appReceived.args[0][0].uri, this.uri);
			test.strictEqual(this.appReceived.args[0][0].dest_id, destId);
			test.strictEqual(this.appReceived.args[0][0].method, 'POST');
			test.deepEqual(this.appReceived.args[0][0].content, this.content);
			test.deepEqual(this.appReceived.args[0][1], { app_name : 'myapp' });
			test.done();
		},
		
		"be able to send a message directly to an address" : function(test) {
			this.messagemgr.sendToAddr(this.uri, this.content, {method : 'POST'}, '3.3.3.3', 3333);

			test.ok(!this.appForwarding.called);
			test.ok(!this.appReceived.called);
			test.strictEqual(this.send.args[0][0], 3333);			
			test.strictEqual(this.send.args[0][1], '3.3.3.3');
			test.strictEqual(this.send.args[0][2].uri, this.uri);
			test.strictEqual(this.send.args[0][2].dest_id, undefined);
			test.strictEqual(this.send.args[0][2].method, 'POST');
			test.deepEqual(this.send.args[0][2].content, this.content);
			test.done();
		},
		
		"be able to send a message directly to an id when remote node is nearest" : function(test) {
			var destId = 'AAAA';
						
			this.messagemgr.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.strictEqual(this.send.args[0][0], 5555);			
			test.strictEqual(this.send.args[0][1], '5.5.5.5');
			test.strictEqual(this.send.args[0][2].uri, this.uri);
			test.strictEqual(this.send.args[0][2].dest_id, destId);
			test.strictEqual(this.send.args[0][2].method, 'POST');
			test.deepEqual(this.send.args[0][2].content, this.content);
			test.deepEqual(this.appForwarding.args[0][0], this.send.args[0][2]);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.done();
		},
		
		"be able to send a message directly to an id when current node is nearest" : function(test) {
			var destId = 'AAAA';
			this.nextHop.id = node.nodeId;
						
			this.messagemgr.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.ok(!this.send.called);
			test.ok(!this.appForwarding.called);
			test.strictEqual(this.appReceived.args[0][0].uri, this.uri);
			test.strictEqual(this.appReceived.args[0][0].dest_id, destId);
			test.strictEqual(this.appReceived.args[0][0].method, 'POST');
			test.deepEqual(this.appReceived.args[0][0].content, this.content);
			test.deepEqual(this.appReceived.args[0][1], { app_name : 'myapp' });
			test.done();
		}
	}),

	"handling of received messages" : testCase({
		setUp : function(done) {
			this.router = { getNextHop : function() {}, suggestBetterHop : function() {} };
			this.transportmgr = mockutil.stubProto(transportmgr.TransportMgr);
			this.messagemgr = new messagemgr.MessageMgr(this.transportmgr);
			this.messagemgr.router = this.router;
			
			node.nodeId = 'ABCD';
			this.send = sinon.stub(this.transportmgr, 'send');
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.gravitiForwarding = sinon.stub();
			this.gravitiReceived = sinon.stub();
			this.msg = { dest_id : 'FEED', he : 'llo'};
			this.msginfo = {
					source_ap : '3.3.3.3:3333',
					app_name : 'myapp'					
			};

			this.messagemgr.on('myapp-app-message-forwarding', this.appForwarding);
			this.messagemgr.on('myapp-app-message-received', this.appReceived);
			this.messagemgr.on('graviti-message-forwarding', this.gravitiForwarding);
			this.messagemgr.on('graviti-message-received', this.gravitiReceived);

			this.nextHop = {
					id : 'CDEF',
					addr : '5.5.5.5',
					port : 5555
				};
			sinon.stub(this.router, 'getNextHop').returns(this.nextHop);
			
			done();
		},
		
		"handle message destined for an app on this node" : function(test) {
			this.nextHop.id = node.nodeId;
			
			this.messagemgr._processMessage(this.msg, this.msginfo);
			
			test.deepEqual(this.appReceived.args[0][0], this.msg);
			test.deepEqual(this.appReceived.args[0][1], this.msginfo);
			test.ok(!this.appForwarding.called);
			test.ok(!this.gravitiForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		},
		
		"handle message destined for graviti on this node" : function(test) {
			this.nextHop.id = node.nodeId;
			this.msginfo.app_name = 'graviti';
			
			this.messagemgr._processMessage(this.msg, this.msginfo);
			
			test.deepEqual(this.gravitiReceived.args[0][0], this.msg);
			test.deepEqual(this.gravitiReceived.args[0][1], this.msginfo);
			test.ok(!this.appForwarding.called);
			test.ok(!this.appReceived.called);
			test.ok(!this.gravitiForwarding.called);
			test.done();
		},
		
		"handle message destined for an app on another node" : function(test) {
			this.messagemgr._processMessage(this.msg, this.msginfo);
			
			test.strictEqual(this.send.args[0][0], 5555);		
			test.strictEqual(this.send.args[0][1], '5.5.5.5');
			test.deepEqual(this.send.args[0][2], this.msg);
			test.deepEqual(this.appForwarding.args[0][0], this.msg);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.ok(!this.gravitiForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		},
		
		"handle message destined for graviti on another node" : function(test) {
			this.msginfo.app_name = 'graviti';
			
			this.messagemgr._processMessage(this.msg, this.msginfo);
			
			test.strictEqual(this.send.args[0][0], 5555);		
			test.strictEqual(this.send.args[0][1], '5.5.5.5');
			test.deepEqual(this.send.args[0][2], this.msg);
			test.deepEqual(this.gravitiForwarding.args[0][0], this.msg);
			test.deepEqual(this.gravitiForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.ok(!this.appForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		}
	})
};