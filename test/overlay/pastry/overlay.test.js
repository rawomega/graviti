var assert = require('assert');
var sinon = require('sinon');
var langutil = require('common/langutil');
var leafset = require('overlay/pastry/leafset');
var bootstrapmgr = require('overlay/pastry/bootstrapmgr');
var heartbeater = require('overlay/pastry/heartbeater');
var overlay = require('overlay/pastry/overlay');
var mockutil = require('testability/mockutil');
var testCase = require('nodeunit').testCase;

module.exports = {
	"staring and joining an overlay" : testCase({
		setUp : function(done) {
			this.bootstrapmgr = mockutil.stubProto(bootstrapmgr.BootstrapMgr);
			this.heartbeater = mockutil.stubProto(heartbeater.Heartbeater);
			this.leafset = new leafset.Leafset();
			this.bootstrapStart = sinon.stub(this.bootstrapmgr, 'start', function(bootstraps, cbk) {
				cbk();
			});
			this.heartbeaterStart = sinon.stub(this.heartbeater, 'start');			
			this.callback = sinon.stub();
			
			this.overlay = new overlay.Overlay(this.leafset, this.bootstrapmgr, this.heartbeater);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start node when starting new ring" : function(test) {
			this.overlay.init(this.callback);
				
			test.ok(this.bootstrapStart.called);
			test.ok(this.callback.called);
			test.done();
		},

		"should start node and initiate bootstrapping when joining an existing ring" : function(test) {
			this.overlay.join('127.0.0.1:4567', this.callback);
			
			test.ok(this.bootstrapStart.calledWith('127.0.0.1:4567'));
			test.ok(this.heartbeaterStart.calledWith());
			test.ok(this.callback.called);
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has started a new ring" : function(test) {
			this.overlay.init(this.callback);
			this.overlay.on('peer-arrived', this.callback);
			
			this.leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer departed event for node leaving the ring, when this node has started a new ring" : function(test) {
			this.overlay.init(this.callback);
			this.overlay.on('peer-departed', this.callback);
			
			this.leafset.emit('peer-departed', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has joined an existing ring" : function(test) {
			this.overlay.join(undefined, this.callback);
			this.overlay.on('peer-arrived', this.callback);
			
			this.leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		}
	}),
/*	
	"sending messages" : testCase({
		setUp : function(done) {
			node.nodeId = 'ABCD';
			sinon.collection.stub(Date, 'now').returns(12345678);
			sinon.collection.stub(id, 'generateUuid').returns('1234');
			this.nextHop = {
					id : 'CDEF',
					addr : '5.5.5.5',
					port : 5555
				};
			sinon.collection.stub(routingmgr, 'getNextHop').returns(this.nextHop);
			
			this.uri = 'p2p:myapp/myresource';
			this.content = {my : 'content'};
			this.send = sinon.collection.stub(transportmgr, 'send');
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.msginfo = {
					app_name : 'myapp',
					next_hop_id : 'CDEF',
					next_hop_addr : '5.5.5.5',
					next_hop_port : 5555
			};

			overlay.on('myapp-app-message-forwarding', this.appForwarding);
			overlay.on('myapp-app-message-received', this.appReceived);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"be able to send a message to a uri mapping to a remote node" : function(test) {
			var destId = uri.parse(this.uri).hash;
			
			overlay.send(this.uri, this.content, {method : 'POST'});
			
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
			
			overlay.send(this.uri, this.content, {method : 'POST'});
						
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
			overlay.sendToAddr(this.uri, this.content, {method : 'POST'}, '3.3.3.3', 3333);

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
						
			overlay.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

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
						
			overlay.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

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
			node.nodeId = 'ABCD';
			this.send = sinon.collection.stub(transportmgr, 'send');
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.gravitiForwarding = sinon.stub();
			this.gravitiReceived = sinon.stub();
			this.msg = { dest_id : 'FEED', he : 'llo'};
			this.msginfo = {
					source_ap : '3.3.3.3:3333',
					app_name : 'myapp'					
			};

			overlay.on('myapp-app-message-forwarding', this.appForwarding);
			overlay.on('myapp-app-message-received', this.appReceived);
			overlay.on('graviti-message-forwarding', this.gravitiForwarding);
			overlay.on('graviti-message-received', this.gravitiReceived);

			this.nextHop = {
					id : 'CDEF',
					addr : '5.5.5.5',
					port : 5555
				};
			sinon.collection.stub(routingmgr, 'getNextHop').returns(this.nextHop);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"handle message destined for an app on this node" : function(test) {
			this.nextHop.id = node.nodeId;
			
			overlay._processMessage(this.msg, this.msginfo);
			
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
			
			overlay._processMessage(this.msg, this.msginfo);
			
			test.deepEqual(this.gravitiReceived.args[0][0], this.msg);
			test.deepEqual(this.gravitiReceived.args[0][1], this.msginfo);
			test.ok(!this.appForwarding.called);
			test.ok(!this.appReceived.called);
			test.ok(!this.gravitiForwarding.called);
			test.done();
		},
		
		"handle message destined for an app on another node" : function(test) {
			overlay._processMessage(this.msg, this.msginfo);
			
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
			
			overlay._processMessage(this.msg, this.msginfo);
			
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
	}),
	
	"leaving a ring" : testCase({
		setUp : function(done) {
			this.transportmgrStop = sinon.collection.stub(transportmgr, 'stop');
			this.heartbeaterStop = sinon.collection.stub(heartbeater, 'stop');
			this.bootstrapmgrStop = sinon.collection.stub(bootstrapmgr, 'stop');
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop node, bootstrapper and heartbeater when leaving ring" : function(test) {	
			// setup
	
			// act
			overlay.leave();
			
			// assert
			test.ok(this.bootstrapmgrStop.called);
			test.ok(this.heartbeaterStop.called);
			test.ok(this.transportmgrStop.called);
			test.done();
		}
	})
*/};