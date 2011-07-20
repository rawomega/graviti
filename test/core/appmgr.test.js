var fs = require('fs');
var sinon = require('sinon');
var appmgr = require('core/appmgr');
var testCase = require('nodeunit').testCase;
var messagemgr = require('messaging/messagemgr');
var overlay = require('overlay/pastry/overlay');
var mockutil = require('testability/mockutil');

module.exports = {
	"loading an app" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);
			this.overlay = mockutil.stubProto(overlay.Overlay);
			this.appmgr = new appmgr.AppMgr(this.messagemgr, this.overlay);
			sinon.collection.stub(fs, "readdirSync").returns(['echoapp.js']);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should load echo app" : function(test) {
			this.appmgr.loadApps('apps');
			
			test.equal(1, this.appmgr.apps.length);
			test.equal('echoapp', this.appmgr.apps[0].name);
			test.done();
		}
	}),
	
	"starting an app" : testCase({
		setUp : function(done) {
			this.messagemgr = 'messagemgr';
			this.overlay = 'overlay';
			this.appmgr = new appmgr.AppMgr(this.messagemgr, this.overlay);
			this.appOne = {active : function() {}};
			this.appTwo = {};
			
			this.active = sinon.stub(this.appOne, 'active');
			
			this.appmgr.apps = [this.appOne, this.appTwo];
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start apps with active method" : function(test) {
			this.appmgr.startApps();
			
			test.ok(this.active.called);
			test.done();
		},
		
		"should inject deps into apps" : function(test) {
			this.appmgr.startApps();
			
			test.strictEqual(this.messagemgr, this.appOne.messagemgr);
			test.strictEqual(this.messagemgr, this.appTwo.messagemgr);
			test.strictEqual(this.overlay, this.appOne.overlay);
			test.strictEqual(this.overlay, this.appTwo.overlay);
			test.done();
		}
	}),
	
	"stopping an app" : testCase({
		setUp : function(done) {
			this.appmgr = new appmgr.AppMgr();
			this.appOne = {passive : function() {}};
			this.appTwo = {};
			
			this.passive = sinon.stub(this.appOne, 'passive');
			
			this.appmgr.apps = [this.appOne, this.appTwo];
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop apps with passive method" : function(test) {
			this.appmgr.stopApps();
			
			test.ok(this.passive.called);
			test.done();
		}
	})
};