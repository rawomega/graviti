var sinon = require('sinon');
var assert = require('assert');
var node = require('../../lib/core/node');
var testCase = require('nodeunit').testCase;
var dgram = require('dgram');

module.exports = {		
	"starting a node" : testCase({
		setUp : function(done) {
			var _this = this;
		 	
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';
			this.rinfo = { 'address' : '127.0.0.2', 'port' : 5678 }
			this.emit = node.emit;
			this.svr = { on : function() {}, bind : function() {}, address : function() {} };
			sinon.stub(this.svr, 'bind');
			sinon.stub(this.svr, 'address').returns({address: "127.0.0.1", port: 1234});
			sinon.stub(this.svr, 'on', function(evt, cbk) {
				if (evt === 'listening')
					cbk();
				else if (evt === 'message')
					cbk(_this.rawmsg, _this.rinfo);
			});
			
			dgram.createSocket = sinon.stub().returns(this.svr);			

			done();
		},
		
		tearDown : function(done) {
			node.emit = this.emit;
			done();
		},
	
		"should start normally" : function(test) {
			// act
			node.start(1234, "127.0.0.1");
	
			// assert		
			test.ok(this.svr.on.calledWith('listening'));
			test.ok(this.svr.on.calledWith('message'));
			test.ok(this.svr.bind.calledOnce);
			test.done();
		},
			
		"should handle listening event on start with callback" : function(test) {
			// setup			
			var success = sinon.stub();
			
			// act
			node.start(1234, "127.0.0.1", { success : success } );
			
			// assert
			test.ok(success.called);
			test.done();
		},
	
		"should handle unparseable message callback" : function(test) {
			// setup		
			this.rawmsg = 'badmsg';
			var emit = sinon.spy();
			node.emit = emit;
			
			// act
			node.start(1234, "127.0.0.1");
			
			// assert
			test.strictEqual(false, emit.called);
			test.done();
		},

		"should throw if no uri in message" : function(test) {
			// setup
			this.rawmsg = '{"key" : "val"}';
			var emit = sinon.spy();
			node.emit = emit;
			
			// act
	
			// assert
			assert.throws(function() {
				node.start(1234, "127.0.0.1");
			}, /no uri/i);
			test.strictEqual(false, emit.called);			
			test.done();
		},
		
		"should throw if hop count over 100" : function(test) {
			// setup
			this.rawmsg = '{"uri" : "p2p:graviti/something", "hops" : 101}';
			var emit = sinon.spy();
			node.emit = emit;
			
			// act
	
			// assert
			assert.throws(function() {
				node.start(1234, "127.0.0.1");
			}, /too many hops/i);
			test.strictEqual(false, emit.called);			
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
			node.start(1234, "127.0.0.1");
	
			// assert
			test.strictEqual('val', rcvdmsg.key);
			test.strictEqual('127.0.0.2', rcvdmsginfo.sender_addr);
			test.strictEqual(5678, rcvdmsginfo.sender_port);
			test.strictEqual('myapp', rcvdmsginfo.app_name);
			test.done();
		}
	}),
	
	"message sending" : testCase({
		"should send with hop zero" : function(test) {
			// setup
			var msg = {"key" : "val"};
			node.server = {send : function() {}};
			var send = sinon.stub(node.server, 'send', function(buf, offset, len, port, addr) {
				test.ok(buf !== null);
				test.strictEqual(0, JSON.parse(buf).hops);
				test.strictEqual(0, offset);
				test.strictEqual(len, buf.length);
				test.strictEqual(port, 2222);
				test.strictEqual('1.1.1.1', addr);
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
			node.server = {send : function() {}};
			var send = sinon.stub(node.server, 'send', function(buf, offset, len, port, addr) {
				test.strictEqual(12, JSON.parse(buf).hops);				
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
			node.server = {close : function() {}};
			var close = sinon.stub(node.server, "close");
	
			// act
			node.stop();
	
			// assert
			test.ok(close.called);
			test.done();
		}
	})
};