var sinon = require('sinon');
var assert = require('assert');
var messagemgr = require('messaging/messagemgr');
var node = require('core/node');
var messages = require('messaging/messages');
var testCase = require('nodeunit').testCase;

module.exports = {		
//
// TODO: we seem to have no tests for ACKs?
//

	"starting a node" : testCase({
		setUp : function(done) {
			var _this = this;

			this.msg = {"uri" : "p2p:myapp/myresource", "key" : "val"};
			this.msginfo = {};
//			this.on = sinon.collection.stub(messagemgr, 'on', function(evt, cbk) {
//				if (evt === 'message')
//					cbk(_this.msg, _this.msginfo);
//			});
			this.messagemgrStart = sinon.collection.stub(messagemgr, 'start', function(port, addr, opts) {
				if (opts && opts.listeningCallback)
					opts.listeningCallback();
			});
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"should start normally" : function(test) {
			node.start(1234, "127.0.0.1");
	
			test.ok(this.messagemgrStart.called);
			test.ok(node.nodeId !== undefined);
			test.done();
		},
		
		"should be able to pass in success callback and have it invoked when node ready" : function(test) {
			var cbk = sinon.stub();
			
			node.start(1234, "127.0.0.1", {success : cbk});
	
			test.ok(cbk.called);
			test.done();
		},
	
		"should not set nodeid if already set (to allow node id injection)" : function(test) {
			node.nodeId = 'FACE';
			
			node.start(1234, "127.0.0.1");

			test.ok(node.nodeId === 'FACE');
			test.done();
		}
	}),

	"message sending" : testCase({
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},		
		
		"should send with hop zero" : function(test) {
			// setup
			var msg = new messages.Message('p2p:myapp/myuri', {"key" : "val"});
			sinon.stub(msg, 'stringify').returns('stringified');
			var send = sinon.collection.stub(messagemgr, 'send', function(port, host, data) {
				test.strictEqual('stringified', data);
				test.strictEqual(2222, port);
				test.strictEqual('1.1.1.1', host);
			});
	
			// // act
			node.send("1.1.1.1", 2222, msg);
	
			// // assert
			test.ok(send.called);
			test.done();
		},

		"should increment hop count when sending" : function(test) {
			// setup
			var msg = new messages.Message('p2p:myapp/myuri', {"key" : "val"}, {"hops" : 11});
			var send = sinon.collection.stub(messagemgr, 'send', function(port, host, data) {
				test.ok(data.indexOf('hops: 12') > -1);				
			});
	
			// act
			node.send("1.1.1.1", 2222, msg);
	
			// assert
			test.ok(send.called);
			test.done();
		}
	}),

	"receiving a message" : testCase({
		setUp : function(done) {
			sinon.collection.stub(messagemgr, 'send');
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';
			done();
		},

		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"should handle unparseable message through socket" : function(test) {
			node.on('message', function() {test.fail('unexpected message');});			

			node.receiveData('badmsg', '127.0.0.1');
			
			test.done();
		},

		"should not process if no uri in message" : function(test) {
			node.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				node.receiveData('GET\n\n{"key" : "val"}', '127.0.0.1');
			}, /destination uri/i);	
			test.done();
		},
		
		"should throw if hop count over 100" : function(test) {
			node.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				node.receiveData('GET p2p:graviti/something\n' +
						'source_port : 123\n' +
						'hops : 101\n\n', '127.0.0.1');
			}, /too many hops/i);			
			test.done();
		},

		"should throw if no source port in message" : function(test) {
			// setup
			node.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				node.receiveData('GET p2p:graviti/something\n\n', '1.2.3.4');
			}, /source port/i);
			test.done();
		},

		"should throw if no sender port in message" : function(test) {
			node.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				node.receiveData('GET p2p:graviti/something\n'
						+ 'source_port: 123\n\n', '1.2.3.4');
			}, /sender port/i);
			test.done();
		},

		"should handle parseable message callback" : function(test) {
			// setup
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			node.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			// act
			node.receiveData('GET p2p:myapp/something\n' +
					'source_port : 1111\n' +
					'sender_port : 2222\n' +
					'key: val\n\n',
				'6.6.6.6');
			
			// assert
			test.strictEqual('val', rcvdmsg.key);
			test.strictEqual('6.6.6.6:2222', rcvdmsginfo.sender_ap);
			test.strictEqual('6.6.6.6:1111', rcvdmsginfo.source_ap);			
			test.strictEqual('myapp', rcvdmsginfo.app_name);
			test.done();
		},
		
		"should handle parseable message in two parts" : function(test) {
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			node.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			var inProgressState = node.receiveData('GET p2p:myapp/something\n', '6.6.6.6');
			node.receiveData('source_port : 1111\n' +
					'sender_port : 2222\n' +
					'key: val\n\n',
				'6.6.6.6', inProgressState
			);
			
			test.strictEqual('val', rcvdmsg.key);
			test.strictEqual('6.6.6.6:2222', rcvdmsginfo.sender_ap);
			test.strictEqual('6.6.6.6:1111', rcvdmsginfo.source_ap);
			test.strictEqual('myapp', rcvdmsginfo.app_name);
			test.done();
		},
		
		"should add source addr to message if not present" : function(test) {
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			node.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			node.receiveData('GET p2p:myapp/something\n' +
					'source_port : 1111\n' +
					'sender_port : 2222\n\n',
				'6.6.6.6'
			);
			
			test.strictEqual('6.6.6.6', rcvdmsg.source_addr);
			test.done();
		}
	}),
	
	"stopping a node" : testCase ({
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop" : function(test) {
			// setup
			var close = sinon.collection.stub(messagemgr, "stop");
	
			// act
			node.stop();
	
			// assert
			test.ok(close.called);
			test.done();
		}
	})
};