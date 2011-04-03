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

			var res = pns.findNearestNode('2.2.2.2:2222', success, error);
			
			test.equal('2.2.2.2', pns._inProgress[res].addr);
			test.equal('2222', pns._inProgress[res].port);
			test.equal(success, pns._inProgress[res].success);
			test.equal(error, pns._inProgress[res].error);
			test.done();
		},
		
		"sholud initiate search for nearest node by sending a requrest for leafset" : function(test) {			
			var res = pns.findNearestNode('2.2.2.2:2222');
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/leafset', {req_id : res}, {method : 'GET'}, '2.2.2.2', '2222'));
			test.done();
		},
		
		"should cancel search for nearest node if not completed within given interval" : function(test) {
			var error = sinon.stub();
			pns.nearestNodeSearchTimeoutMsec = 100;
			
			var res = pns.findNearestNode('2.2.2.2:2222', undefined, error);
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
		
		"sholud respond with leafset upon receipt of pns leafset request" : function(test) {			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/leafset', {
					req_id : 'moo',
					leafset : { dummy : 'leafset'}
				}, {method : 'POST'}, '1.1.1.1', '1111'));
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
		
		"when no leafset is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var success = sinon.stub();
			var reqId = pns.findNearestNode('2.2.2.2:2222', success);
			this.msg.content = {
					req_id : reqId,
					leafset : {}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(success.calledWith('1EAF5E7', '2.2.2.2:2222'));
			test.equal(0, Object.keys(pns._inProgress).length);
			test.done();
		},
		
		"when leafset is not empty in pns leafset response, should initiate round trip probes" : function(test) {			
			var success = sinon.stub();
			var reqId = pns.findNearestNode('2.2.2.2:2222', success);
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
			test.ok(0 < pns._inProgress[reqId].leafset_probes['ABCDEF']);
			test.ok(0 < pns._inProgress[reqId].leafset_probes['123456']);
			test.done();
		}
	}),
	
	"handling round trip probe message" : testCase({
		setUp : function(done) {
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			this.msg = {
					method : 'GET',
					uri : 'p2p:graviti/pns/rttprobe',
					content : {
						req_id : 'reqid'
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

		"when a rtt probe request is received, respond with a simple echo" : function(test) {
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : 'reqid'}, {method : 'POST'}, '1.1.1.1', '1111'));			
			test.done();
		}
	}),
	
	"handling round trip probe response message" : testCase({
		setUp : function(done) {
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			this.msg = {
					method : 'POST',
					uri : 'p2p:graviti/pns/rttprobe',
					source_id : 'C105357',
					content : {
						req_id : 'replaceme'
					}
			};
			this.msginfo = {
					source_ap : '3.3.3.3:3333'
			}
			pns.init(this.overlayCallback);
			
			done();
		},
		
		tearDown : function(done) {
			pns._inProgress = {};
			sinon.collection.restore();
			done();
		},

		"when the first of a series of rtt probe responses is received, store as nearest node and initiate routing table traversal" : function(test) {
			var reqId = pns.findNearestNode('2.2.2.2:2222');
			pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			this.msg.content.req_id = reqId;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, pns._inProgress[reqId].leafset_probes);
			test.equal('C105357', pns._inProgress[reqId].nearest.id);
			test.equal('3.3.3.3:3333', pns._inProgress[reqId].nearest.ap);
			test.ok(0 <= pns._inProgress[reqId].nearest.rtt);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when the first rtt probe response is further than current best, report it and finish up" : function(test) {
			var success = sinon.stub();
			var reqId = pns.findNearestNode('2.2.2.2:2222', success);
			pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			pns._inProgress[reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1
			};
			this.msg.content.req_id = reqId;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(success.calledWith('8377371D', '2.2.2.2:2222'));
			test.equal(0, Object.keys(pns._inProgress).length);						
			test.done();
		},
		
		"when an unexpected or later rtt probe response is received, throw it away" : function(test) {
			var reqId = pns.findNearestNode('2.2.2.2:2222');
			pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			this.msg.content.req_id = reqId;			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.source_id = '734F';
			this.msginfo.source_ap = '9.9.9.9';
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, pns._inProgress[reqId].leafset_probes);
			test.equal('C105357', pns._inProgress[reqId].nearest.id);
			test.ok(this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));		
			test.ok(!this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : reqId,
				depth : 10
			}, {method : 'GET'}, '9.9.9.9', '9999'));
			test.done();
		}
	})
}