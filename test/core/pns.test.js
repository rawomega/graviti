var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var pns = require('core/pns');
var langutil = require('common/langutil');
var leafset = require('core/leafset');

module.exports = {
	"initiating pns nearest node search" : testCase({
		setUp : function(done) {
			this.overlayCallback = { sendToAddr : function() {}, on : function() {} };
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			pns.init(this.overlayCallback);
			
			done();
		},
		
		tearDown : function(done) {
			pns.nearestNodeSearchTimeoutMsec = 20000;
			pns._inProgress = {};
			sinon.collection.restore();
			done();
		},
		
		"sholud store state when initiating search for nearest node" : function(test) {			
			var success = sinon.stub();
			var error = sinon.stub();

			var res = pns.findNearestNode('1.1.1.1:1111', success, error);
			
			test.equal('1.1.1.1', pns._inProgress[res].addr);
			test.equal('1111', pns._inProgress[res].port);
			test.equal(success, pns._inProgress[res].success);
			test.equal(error, pns._inProgress[res].error);
			test.done();
		},
		
		"sholud initiate search for nearest node by sending a requrest for leafset" : function(test) {			
			var res = pns.findNearestNode('1.1.1.1:1111');
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/leafset', {req_id : res}, {method : 'GET'}, '1.1.1.1', '1111'));
			test.done();
		},
		
		"should cancel search for nearest node if not completed within given interval" : function(test) {
			var error = sinon.stub();
			pns.nearestNodeSearchTimeoutMsec = 100;
			
			var res = pns.findNearestNode('1.1.1.1:1111', undefined, error);
			setTimeout(function() {
				test.equal(0, Object.keys(pns._inProgress).length);
				test.ok(error.called);
				test.done();
			}, 200);
		}
	}),
	
	"handling leafset request message" : testCase({
		setUp : function(done) {
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			sinon.collection.stub(leafset, 'compressedLeafset').returns({ dummy : 'leafset'});
			this.msg = {
					method : 'GET',
					uri : 'p2p:graviti/pns/leafset',
					content : { req_id : 'moo' }
			};
			this.msginfo = {
					source_ap : '2.2.2.2:2222'
			}
			pns.init(this.overlayCallback);
			
			done();
		},
		
		tearDown : function(done) {
			pns._inProgress = {};
			sinon.collection.restore();
			done();
		},
		
		"sholud respond with leafset upon receipt of pns leafset request" : function(test) {			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/leafset', {
					req_id : 'moo',
					leafset : { dummy : 'leafset'}
				}, {method : 'POST'}, '2.2.2.2', '2222'));
			test.done();
		}
	}),
	
	"handling leafset response message" : testCase({
		setUp : function(done) {
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			sinon.collection.stub(leafset, 'compressedLeafset').returns({ dummy : 'leafset'});
			this.msg = {
					method : 'POST',
					uri : 'p2p:graviti/pns/leafset',
					content : {
						req_id : 'replaceme',
						leafset : {my : 'leafset'}
					}
			};
			this.msginfo = {
					source_ap : '1.1.1.1:1111'
			}
			pns.init(this.overlayCallback);
			
			done();
		},
		
		tearDown : function(done) {
			pns._inProgress = {};
			sinon.collection.restore();
			done();
		},
		
		"when no leafset is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var success = sinon.stub();
			var reqId = pns.findNearestNode('1.1.1.1:1111', success);
			this.msg.content = {
					req_id : reqId,
					leafset : {}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(success.calledWith('1EAF5E7'));
			test.equal(0, Object.keys(pns._inProgress).length);
			test.done();
		},
		
		"when leafset is not empty in pns leafset response, should initiate round trip probes" : function(test) {			
			var success = sinon.stub();
			var reqId = pns.findNearestNode('1.1.1.1:1111', success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333',
						'123456' : '4.4.4.4:4444'
					}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '4.4.4.4', '4444'));
			test.done();
		}
	})
}