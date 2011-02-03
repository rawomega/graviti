var gently = global.GENTLY = new (require('gently'));
var assert = require('assert');
var mod_node = require('node');

var server = undefined;
var listeningCallback = undefined;
var messageCallback = undefined;
function setupStartExpectations() {
	server = new Object();
	gently.expect(gently.hijacked.dgram, 'createSocket', function(proto) {
		assert.eql('udp4', proto);
		return server;
	});
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

module.exports = {
	setUp : function() {
	},
	
	shouldStart : function() {
		// setup
		setupStartExpectations();

		// act
		mod_node.start(1234, "127.0.0.1");

		// assert
		gently.verify();
	},
	
	shouldHandleListeningEventOnStart : function() {
		// setup
		setupStartExpectations();
		gently.expect(server, "address", function() {
                	return {address: "127.0.0.1", port: 1234};
                });

		// act
		mod_node.start(1234, "127.0.0.1");
		listeningCallback();

		// assert
		gently.verify();
	},
	
	shouldHandleUnparseableMessageCallback : function() {
		// setup
		setupStartExpectations();
		var rinfo = { 'address' : '127.0.0.1', 'port' : 1234 };

		// act
		mod_node.start(1234, "127.0.0.1");
		messageCallback('msg', rinfo);

		// assert
		gently.verify();
	},

	shouldThrowIfNoUriInMessage : function() {
		// setup
		setupStartExpectations();
		var rinfo = { 'address' : '127.0.0.2', 'port' : 1234 };

		mod_node.start(1234, "127.0.0.1");

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
		mod_node.on("message", function(msg, msginfo) {
			rcvdmsg = msg;
			rcvdmsginfo = msginfo
		});

		// act
		mod_node.start(1234, "127.0.0.1");
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
		mod_node.server = server;
		gently.expect(mod_node.server, "send", function(buf, offset, len, port, addr) {
			assert.ok(buf !== null);
			assert.eql(0, offset);
			assert.eql(len, buf.length);
			assert.eql(port, 2222);
			assert.eql('1.1.1.1', addr);
		});

		// act
		mod_node.send("1.1.1.1", 2222, msg);

		// assert
		gently.verify();
	},
	
	shouldStop : function() {
		// setup
		var server = new Object();
		mod_node.server = server;
		gently.expect(mod_node.server, "close", function() {
		});

		// act
		mod_node.stop();

		// assert
		gently.verify();
	}
};