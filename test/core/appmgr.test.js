var fs = require('fs');
var sinon = require('sinon');
var appmgr = require('core/appmgr');
var testCase = require('nodeunit').testCase;

module.exports = {
	"loading an app" : testCase({
		setUp : function(done) {
			sinon.collection.stub(fs, "readdirSync").returns(['echoapp.js']);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should load echo app" : function(test) {
			appmgr.loadApps('apps');
			
			test.equal(1, appmgr.apps.length);
			test.equal('echoapp', appmgr.apps[0].name);
			test.done();
		}
	}),
	
	"starting an app" : testCase({
		setUp : function(done) {
			this.appOne = {active : function() {}};
			this.appTwo = {};
			
			this.active = sinon.stub(this.appOne, 'active');
			
			appmgr.apps = [this.appOne, this.appTwo];
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start apps with active method" : function(test) {
			appmgr.startApps();
			
			test.ok(this.active.called);
			test.done();
		}
	}),
	
	"stopping an app" : testCase({
		setUp : function(done) {
			this.appOne = {passive : function() {}};
			this.appTwo = {};
			
			this.passive = sinon.stub(this.appOne, 'passive');
			
			appmgr.apps = [this.appOne, this.appTwo];
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop apps with passive method" : function(test) {
			appmgr.stopApps();
			
			test.ok(this.passive.called);
			test.done();
		}
	})
};