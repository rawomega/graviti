var assert = require('assert');
var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var node = require('../../lib/core/node');
var ringutil= require('../../lib/core/ringutil');
var routingmgr = require('../../lib/core/routingmgr');
var id = require('../../lib/common/id');
var uri = require('../../lib/common/uri');
var bootstrapmgr = require('../../lib/core/bootstrapmgr');
var overlay = require('../../lib/core/overlay');

module.exports = {
	"staring and joining an overlay" : testCase({
		setUp : function(done) {
			this.nodeStart = sinon.collection.stub(node, 'start', function(a, b, opt) {
				opt.success();
			});
			this.bootstrapStart = sinon.collection.stub(bootstrapmgr, 'start');
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
			test.ok(this.bootstrapStart.calledWith(overlay));
			test.ok(this.callback.called);
			test.done();
		},

		"should start node and initiate bootstrapping when joining an existing ring" : function(test) {
			overlay.join(1234, "127.0.0.1", '127.0.0.1:4567', this.callback);
			overlay.emit('bootstrap-completed');
			
			test.ok(this.nodeStart.calledWith(1234, "127.0.0.1"));
			test.ok(this.bootstrapStart.calledWith(overlay, '127.0.0.1:4567'));
			test.ok(this.callback.called);
			test.done();
		}
	}),
	
	"sending messages" : testCase({
		setUp : function(done) {
			node.nodeId = 'ABCD';
			sinon.collection.stub(Date.prototype, 'getTime').returns(12345678);
			sinon.collection.stub(id, 'generateUuid').returns('1234');
			sinon.collection.stub(routingmgr, 'getNextHop').returns({
				id : 'CDEF',
				addr : '5.5.5.5',
				port : 5555
			});
			
			this.uri = 'p2p:myapp/myresource';
			this.content = {my : 'content'};
			this.send = sinon.collection.stub(node, 'send')
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.msg = {
					msg_id : '1234',
					source_id : 'ABCD',
					dest_id : 'replace_me_in_test',
					created : 12345678,
					uri : this.uri,
					method : 'POST',
					content : this.content
			};
			this.msginfo = {
					app_name : 'myapp',
					next_hop_id : 'CDEF',
					next_hop_addr : '5.5.5.5',
					next_hop_port : 5555,
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
			this.msg.dest_id = uri.parse(this.uri).hash;
			sinon.collection.stub(ringutil, 'amINearest').returns(false);
			
			overlay.send(this.uri, this.content, {method : 'POST'});
			
			test.strictEqual(this.send.args[0][0], '5.5.5.5');
			test.strictEqual(this.send.args[0][1], 5555);			
			test.deepEqual(this.send.args[0][2], this.msg);
			test.deepEqual(this.appForwarding.args[0][0], this.msg);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.done();
		},
		
		"be able to send a message to a uri mapping to the current node" : function(test) {
			this.msg.dest_id =  uri.parse(this.uri).hash;
			sinon.collection.stub(ringutil, 'amINearest').returns(true);
			
			overlay.send(this.uri, this.content, {method : 'POST'});
						
			test.ok(!this.send.called);
			test.ok(!this.appForwarding.called);
			test.deepEqual(this.appReceived.args[0][0], this.msg);
			test.deepEqual(this.appReceived.args[0][1], { app_name : 'myapp' });
			test.done();
		},
		
		"be able to send a message directly to an address" : function(test) {
			this.msg.dest_id = '';
						
			overlay.sendToAddr(this.uri, this.content, {method : 'POST'}, '3.3.3.3', 3333);

			test.ok(!this.appForwarding.called);
			test.ok(!this.appReceived.called);
			test.strictEqual(this.send.args[0][0], '3.3.3.3');
			test.strictEqual(this.send.args[0][1], 3333);			
			test.deepEqual(this.send.args[0][2], this.msg);
			test.done();
		},
		
		"be able to send a message directly to an id when remote node is nearest" : function(test) {
			this.msg.dest_id = 'AAAA';
			sinon.collection.stub(ringutil, 'amINearest').returns(false);
						
			overlay.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.strictEqual(this.send.args[0][0], '5.5.5.5');
			test.strictEqual(this.send.args[0][1], 5555);			
			test.deepEqual(this.send.args[0][2], this.msg);
			test.deepEqual(this.appForwarding.args[0][0], this.msg);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.done();
		},
		
		"be able to send a message directly to an id when current node is nearest" : function(test) {
			this.msg.dest_id = 'AAAA';
			sinon.collection.stub(ringutil, 'amINearest').returns(true);
						
			overlay.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.ok(!this.send.called);
			test.ok(!this.appForwarding.called);
			test.deepEqual(this.appReceived.args[0][0], this.msg);
			test.deepEqual(this.appReceived.args[0][1], { app_name : 'myapp' });
			test.done();
		}
	}),
	
	"leaving a ring" : testCase({
		setUp : function(done) {
			this.node = sinon.collection.mock(node);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop node when leaving ring" : function(test) {	
			// setup
			this.node.expects('stop');
	
			// act
			overlay.leave();
			
			// assert
			this.node.verify();
			test.done();
		}
	})
};