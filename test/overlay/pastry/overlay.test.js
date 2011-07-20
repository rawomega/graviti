var assert = require('assert');
var sinon = require('sinon');
var langutil = require('common/langutil');
var leafset = require('overlay/pastry/leafset');
var bootstrapmgr = require('overlay/pastry/bootstrapmgr');
var heartbeater = require('overlay/pastry/heartbeater');
var overlay = require('overlay/pastry/overlay');
var mockutil = require('testability/mockutil');
var testCase = require('nodeunit').testCase;

module.exports = {
	"staring and joining an overlay" : testCase({
		setUp : function(done) {
			this.bootstrapmgr = mockutil.stubProto(bootstrapmgr.BootstrapMgr);
			this.heartbeater = mockutil.stubProto(heartbeater.Heartbeater);
			this.leafset = new leafset.Leafset();
			this.bootstrapStart = sinon.stub(this.bootstrapmgr, 'start', function(bootstraps, cbk) {
				cbk();
			});
			this.heartbeaterStart = sinon.stub(this.heartbeater, 'start');			
			this.callback = sinon.stub();
			
			this.overlay = new overlay.Overlay(this.leafset, this.bootstrapmgr, this.heartbeater);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start node when starting new ring" : function(test) {
			this.overlay.init(this.callback);
				
			test.ok(this.bootstrapStart.called);
			test.ok(this.heartbeaterStart.calledWith());
			test.ok(this.callback.called);
			test.done();
		},

		"should start node and initiate bootstrapping when joining an existing ring" : function(test) {
			this.overlay.join('127.0.0.1:4567', this.callback);
			
			test.ok(this.bootstrapStart.calledWith('127.0.0.1:4567'));
			test.ok(this.heartbeaterStart.calledWith());
			test.ok(this.callback.called);
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has started a new ring" : function(test) {
			this.overlay.init(this.callback);
			this.overlay.on('peer-arrived', this.callback);
			
			this.leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer departed event for node leaving the ring, when this node has started a new ring" : function(test) {
			this.overlay.init(this.callback);
			this.overlay.on('peer-departed', this.callback);
			
			this.leafset.emit('peer-departed', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has joined an existing ring" : function(test) {
			this.overlay.join(undefined, this.callback);
			this.overlay.on('peer-arrived', this.callback);
			
			this.leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		}
	})
};