var assert = require('assert');
var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var node = require('core/node');
var leafset = require('core/leafset');
var routingmgr = require('core/routingmgr');
var routingtable = require('core/routingtable');
var id = require('common/id');
var uri = require('common/uri');
var bootstrapmgr = require('core/bootstrapmgr');
var heartbeater = require('core/heartbeater');
var overlay = require('core/overlay');

module.exports = {
	"staring and joining an overlay" : testCase({
		setUp : function(done) {
			this.nodeStart = sinon.collection.stub(node, 'start', function(a, b, opt) {
				opt.success();
			});
			this.nodeOn = sinon.collection.stub(node, 'on');
			this.bootstrapStart = sinon.collection.stub(bootstrapmgr, 'start');
			this.heartbeatStart = sinon.collection.stub(heartbeater, 'start');
			this.callback = sinon.stub();
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start node when starting new ring" : function(test) {
			overlay.init(1234, "127.0.0.1", this.callback);
				
			test.ok(this.nodeStart.calledWith(1234, "127.0.0.1"));
			test.ok(this.nodeOn.calledWith('message', overlay._processMessage));
			test.ok(this.bootstrapStart.calledWith(overlay));
			test.ok(this.heartbeatStart.calledWith(overlay));
			test.ok(this.callback.called);
			test.done();
		},

		"should start node and initiate bootstrapping when joining an existing ring" : function(test) {
			overlay.join(1234, "127.0.0.1", '127.0.0.1:4567', this.callback);
			overlay.emit('bootstrap-completed');
			
			test.ok(this.nodeStart.calledWith(1234, "127.0.0.1"));
			test.ok(this.nodeOn.calledWith('message', overlay._processMessage));
			test.ok(this.bootstrapStart.calledWith(overlay, '127.0.0.1:4567'));
			test.ok(this.heartbeatStart.calledWith(overlay));
			test.ok(this.callback.called);
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has started a new ring" : function(test) {
			overlay.init(1234, "127.0.0.1");
			leafset.on('peer-arrived', this.callback);
			
			leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer departed event for node leaving the ring, when this node has started a new ring" : function(test) {
			overlay.init(1234, "127.0.0.1");
			leafset.on('peer-departed', this.callback);
			
			leafset.emit('peer-departed', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has joined an existing ring" : function(test) {
			var callback = sinon.stub();
			overlay.join(1234, "127.0.0.1");
			leafset.on('peer-arrived', this.callback);
			
			leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer departed event for node leaving the ring, when this node has joined an existing ring" : function(test) {
			var callback = sinon.stub();
			overlay.join(1234, "127.0.0.1");
			leafset.on('peer-departed', this.callback);
			
			leafset.emit('peer-departed', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		}
	}),
	
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
			this.send = sinon.collection.stub(node, 'send');
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
			
			test.strictEqual(this.send.args[0][0], '5.5.5.5');
			test.strictEqual(this.send.args[0][1], 5555);			
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
			test.strictEqual(this.send.args[0][0], '3.3.3.3');
			test.strictEqual(this.send.args[0][1], 3333);			
			test.strictEqual(this.send.args[0][2].uri, this.uri);
			test.strictEqual(this.send.args[0][2].dest_id, undefined);
			test.strictEqual(this.send.args[0][2].method, 'POST');
			test.deepEqual(this.send.args[0][2].content, this.content);
			test.done();
		},
		
		"be able to send a message directly to an id when remote node is nearest" : function(test) {
			var destId = 'AAAA';
						
			overlay.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.strictEqual(this.send.args[0][0], '5.5.5.5');
			test.strictEqual(this.send.args[0][1], 5555);			
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
			this.send = sinon.collection.stub(node, 'send');
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
			
			test.strictEqual(this.send.args[0][0], '5.5.5.5');
			test.strictEqual(this.send.args[0][1], 5555);		
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
			
			test.strictEqual(this.send.args[0][0], '5.5.5.5');
			test.strictEqual(this.send.args[0][1], 5555);		
			test.deepEqual(this.send.args[0][2], this.msg);
			test.deepEqual(this.gravitiForwarding.args[0][0], this.msg);
			test.deepEqual(this.gravitiForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.ok(!this.appForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		},
		
		"tell upstream node if we have a better route for the message being routed than ourselves" : function(test) {
			var sendHeartbeat = sinon.collection.stub(heartbeater, 'sendHeartbeatToAddr');
			var rtFindBetterRoutingHop = sinon.collection.stub(routingtable, 'findBetterRoutingHop').returns({
				row : 'some row'
			});
			
			overlay._processMessage(this.msg, this.msginfo);
					
			test.ok(sendHeartbeat.calledOnce);
			test.equal('3.3.3.3', sendHeartbeat.args[0][0]);
			test.equal('3333', sendHeartbeat.args[0][1]);
			test.deepEqual({routing_table : 'some row'}, sendHeartbeat.args[0][2]);			
			test.done();
		}
	}),
	
	"leaving a ring" : testCase({
		setUp : function(done) {
			this.node = sinon.collection.mock(node);
			this.heartbeater = sinon.collection.mock(heartbeater);
			this.bootstrapmgr = sinon.collection.mock(bootstrapmgr);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop node, bootstrapper and heartbeater when leaving ring" : function(test) {	
			// setup
			this.heartbeater.expects('stop');
			this.bootstrapmgr.expects('stop');
			this.node.expects('stop');
	
			// act
			overlay.leave();
			
			// assert
			this.bootstrapmgr.verify();
			this.heartbeater.verify();
			this.node.verify();
			test.done();
		}
	})
};