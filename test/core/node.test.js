var sinon = require('sinon');
var assert = require('assert');
var node = require('../../lib/core/node');
var connmgr = require('../../lib/core/connmgr');
var testCase = require('nodeunit').testCase;

module.exports = {		
	"starting a node" : testCase({
		setUp : function(done) {
			var _this = this;
		 	
			this.msg = {"uri" : "p2p:myapp/myresource", "key" : "val"};
			this.msginfo = {};
			this.connmgrOn = connmgr.on;
			sinon.stub(connmgr, 'on', function(evt, cbk) {
				if (evt === 'message')
					cbk(_this.msg, _this.msginfo);
			});

			done();
		},
		
		tearDown : function(done) {
			connmgr.on = this.connmgrOn;
			done();
		},
	
		"should start normally" : function(test) {
			// act
			node.start(1234, "127.0.0.1");
	
			// assert		
			test.ok(connmgr.on.calledWith('message'));
			test.done();
		},
			
		"should re-emit message callback" : function(test) {
			// setup
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			node.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			// act
			node.start(1234, "127.0.0.1");
	
			// assert
			test.deepEqual(this.msg, rcvdmsg);
			test.deepEqual(this.msginfo, rcvdmsginfo);
			test.done();
		}
	}),
	
	"message sending" : testCase({
		"should send with hop zero" : function(test) {
			// setup
			var msg = {"key" : "val"};
			connmgr.send = function() {};
			var send = sinon.stub(connmgr, 'send', function(port, host, data) {
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
			var send = sinon.stub(connmgr, 'send', function(port, host, data) {
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
		"should stop" : function(test) {
			// setup
			var close = sinon.stub(connmgr, "stopListening", function() {
				connmgr.emit('close');
			});
	
			// act
			node.stop();
	
			// assert
			test.ok(close.called);
			test.strictEqual(undefined, node.nodeId);
			test.done();
		}
	})
};