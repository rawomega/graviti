var sinon = require('sinon');
var node = require('core/node');
var testCase = require('nodeunit').testCase;
var messagemgr = require('messaging/messagemgr');

module.exports = {		
//
// TODO: we seem to have no tests for ACKs?
//

	"starting a node" : testCase({
		setUp : function(done) {
			var _this = this;

			this.msg = {"uri" : "p2p:myapp/myresource", "key" : "val"};
			this.msginfo = {};

			this.messagemgrStart = sinon.collection.stub(messagemgr, 'start', function(port, addr, readyCbk) {
				if (readyCbk) readyCbk();
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
		
		"should listen to messages and re-emit them" : function(test) {
			var cbk = sinon.stub();
			node.on('message', cbk);
			
			node.start(1234, "127.0.0.1");
			messagemgr.emit('message', 'msg', 'msginfo');
			
			test.ok(cbk.calledWith('msg', 'msginfo'));
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