var assert = require('assert');
var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var node = require('../../lib/core/node');
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