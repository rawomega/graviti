var sinon = require('sinon');
var assert = require('assert');
var node = require('node');

/*
var server = undefined;
var listeningCallback = undefined;
var messageCallback = undefined;
function setupStartExpectations() {
	server = new Object();
	gently.expect(server, "on", function(evt, callback) {
	    assert.eql('listening', evt);
	    listeningCallback = callback;
	});
	gently.expect(server, "on", function(evt, callback) {
		assert.eql('message', evt);
		messageCallback = callback;
	    });
	gently.expect(server, "bind", function(port, addr) {
		assert.eql(1234, port);
	    assert.eql("127.0.0.1", addr);
	});
}
*/


module.exports = {
/*
	"should start normally" : function() {
		// setup
		var svr = { on : function() {}, bind : function() {}, address : function() {} };
		sinon.stub(svr, 'on');
		sinon.stub(svr, 'bind');
		sinon.stub(svr, 'address');

		var mockdgram = sinon.mock(require('dgram'));
		mockdgram.expects('createSocket').withArgs('udp4').returns(svr);

		// act
		node.start(1234, "127.0.0.1");

		// assert
		mockdgram.verify();		
		assert.ok(svr.on.calledWith('listening'));
		assert.ok(svr.on.calledWith('message'));
		assert.ok(svr.bind.calledOnce);
	},
 */	

	"should handle listening event on start with callback" : function() {
		// setup
		var svr = { on : function() {}, bind : function() {}, address : function() {} };
		sinon.stub(svr, 'bind');
		sinon.stub(svr, 'address').returns({address: "127.0.0.1", port: 1234});
		sinon.stub(svr, 'on', function(evt, cbk) {
			if (evt === 'listening')
				cbk();
		});

		var mockdgram = sinon.mock(require('dgram'));
		mockdgram.expects('createSocket').withArgs('udp4').returns(svr);

		var success = sinon.stub();
		
		// act
		node.start(1234, "127.0.0.1", { success : success } );

		// assert
		assert.ok(success.called);
	},
	
	"should handle unparseable message callback" : function() {
		// setup		
		var rinfo = { 'address' : '127.0.0.1', 'port' : 1234 };
		
		var svr = { on : function() {}, bind : function() {}, address : function() {} };
		sinon.stub(svr, 'bind');
		sinon.stub(svr, 'address'); //.returns({address: "127.0.0.1", port: 1234});
		sinon.stub(svr, 'on', function(evt, cbk) {
			if (evt === 'message')
				cbk('badmsg', rinfo);
		});

		var mockdgram = sinon.mock(require('dgram'));
		mockdgram.expects('createSocket').withArgs('udp4').returns(svr);

		var emit = sinon.spy(node, 'emit');

		// act
		node.start(1234, "127.0.0.1");

		// assert
		assert.eql(false, emit.called);
	},
/*
	shouldThrowIfNoUriInMessage : function() {
		// setup
		setupStartExpectations();
		var rinfo = { 'address' : '127.0.0.2', 'port' : 1234 };

		node.start(1234, "127.0.0.1");

		// assert
		assert.throws(function() {
				messageCallback('{"key" : "val"}', rinfo);            
			}, /no uri/i
		);
	},
	
	shouldHandleParseableMessageCallback : function() {
		// setup
		setupStartExpectations();
		var rinfo = { 'address' : '127.0.0.2', 'port' : 1234 };

		var rcvdmsg = undefined;
		var rcvdmsginfo = undefined;
		node.on("message", function(msg, msginfo) {
			rcvdmsg = msg;
			rcvdmsginfo = msginfo
		});

		// act
		node.start(1234, "127.0.0.1");
		messageCallback('{"uri" : "p2p:myapp/myresource", "key" : "val"}', rinfo);

		// assert
		gently.verify();
		assert.eql('val', rcvdmsg.key);
		assert.eql('127.0.0.2', rcvdmsginfo.sender_addr);
		assert.eql(1234, rcvdmsginfo.sender_port);
		assert.eql('myapp', rcvdmsginfo.app_name);
	},
	
	shouldSend : function() {
		// setup
		var msg = {"key" : "val"};
		var server = new Object();
		node.server = server;
		gently.expect(node.server, "send", function(buf, offset, len, port, addr) {
			assert.ok(buf !== null);
			assert.eql(0, offset);
			assert.eql(len, buf.length);
			assert.eql(port, 2222);
			assert.eql('1.1.1.1', addr);
		});

		// act
		node.send("1.1.1.1", 2222, msg);

		// assert
		gently.verify();
	},
	
	shouldStop : function() {
		// setup
		var server = new Object();
		node.server = server;
		gently.expect(node.server, "close", function() {
		});

		// act
		node.stop();

		// assert
		gently.verify();
	}
*/	
};