var sinon = require('sinon');
var assert = require('assert');
var node = require('core/node');
var connmgr = require('core/connmgr');
var testCase = require('nodeunit').testCase;

module.exports = {		
	"starting a node" : testCase({
		setUp : function(done) {
			var _this = this;
		 	
			this.msg = {"uri" : "p2p:myapp/myresource", "key" : "val"};
			this.msginfo = {};
			this.connmgrOn = connmgr.on;
			sinon.collection.stub(connmgr, 'on', function(evt, cbk) {
				if (evt === 'message')
					cbk(_this.msg, _this.msginfo);
			});

			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
	
		"should start normally" : function(test) {
			node.start(1234, "127.0.0.1");
	
			test.ok(connmgr.on.calledWith('message'));
			test.ok(node.nodeId !== undefined);
			test.done();
		},
		
		"should not set nodeid if already set (to allow node id injection)" : function(test) {
			node.nodeId = 'FACE'
			
			node.start(1234, "127.0.0.1");
	
			test.ok(connmgr.on.calledWith('message'));
			test.ok(node.nodeId === 'FACE');
			test.done();
		},
			
		"should re-emit message callback" : function(test) {
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			node.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			node.start(1234, "127.0.0.1");
	
			test.deepEqual(this.msg, rcvdmsg);
			test.deepEqual(this.msginfo, rcvdmsginfo);
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
			var msg = {"key" : "val"};
			connmgr.send = function() {};
			var send = sinon.collection.stub(connmgr, 'send', function(port, host, data) {
				test.deepEqual(JSON.stringify(msg), data);
				test.strictEqual(2222, port);
				test.strictEqual('1.1.1.1', host);
			});
	
			// act
			node.send("1.1.1.1", 2222, msg);
	
			// assert
			test.ok(send.called);
			test.done();
		},
		
		"should increment hop count when sending" : function(test) {
			// setup
			var msg = {key : "val", hops : 11};
			connmgr.send = function() {};
			var send = sinon.collection.stub(connmgr, 'send', function(port, host, data) {
				test.strictEqual(12, JSON.parse(data).hops);				
			});
	
			// act
			node.send("1.1.1.1", 2222, msg);
	
			// assert
			test.ok(send.called);
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
			var close = sinon.collection.stub(connmgr, "stopListening", function() {
				connmgr.emit('close');
			});
	
			// act
			node.stop();
	
			// assert
			test.ok(close.called);
			test.done();
		}
	})
};