var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var pns = require('overlay/pns');
var langutil = require('common/langutil');
var leafset = require('overlay/leafset');
var routingtable = require('overlay/routingtable');
var node = require('core/node');
var id = require('common/id');

var joiningNodeId = '1014149403101414940310141494031014149403';

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

			var res = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success, error);
			
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
			
			var res = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, undefined, error);
			setTimeout(function() {
				test.equal(0, Object.keys(pns._inProgress).length);
				test.ok(error.called);
				test.done();
			}, 200);
		}
	}),
	
	"cancelling all pns node searches" : testCase({
		setUp : function(done) {
			this.overlayCallback = { sendToAddr : function() {}, on : function() {} };			
			pns.init(this.overlayCallback);
			
			done();
		},
		
		tearDown : function(done) {
			pns._inProgress = {};
			pns.nearestNodeSearchTimeoutMsec = 20000;
			done();
		},
		
		"should throw away all state when PNS search cancelled" : function(test) {			
			var res = pns.findNearestNode('2.2.2.2:2222');
			
			pns.cancelAll();
			
			test.equal(0, Object.keys(pns._inProgress).length);
			test.done();
		},
		
		"should stop all timers when PNS search cancelled" : function(test) {
			pns.nearestNodeSearchTimeoutMsec = 100;
			var error = sinon.stub();
			var res = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, undefined, error);
			
			pns.cancelAll();
			
			setTimeout(function() {
				test.ok(!error.called);
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
			this.success = sinon.stub();
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
		
		"when req id in response not known, do nothing" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : 'some-other-req-id',
					leafset : {}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(1, this.sendToAddr.callCount);
			test.ok(!this.success.called);
			test.done();
		},
		
		"when no leafset is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.success.calledWith({
				id : '1EAF5E7',
				ap : '2.2.2.2:2222',
				rtt : pns.rttWhenInsufficientPeers,
				discovered_peers : [],
				public_seed_ap : '2.2.2.2:2222'
			}));
			test.equal(0, Object.keys(pns._inProgress).length);
			test.done();
		},
		
		"when leafset contains joining node id, disregard that entry" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333'
					}
			};
			this.msg.content.leafset[joiningNodeId] = '4.4.4.4:4444';
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(2, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.done();
		},
		
		"track leafset nodes as discovered nodes for current request, without duplicates" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333',
						'123456' : '4.4.4.4:4444',
						'789ABC' : '5.5.5.5:5555'
					}
			};
			this.msg.source_id = '1EAF5E7';
			pns._inProgress[reqId].discoveredPeers.push('5.5.5.5:5555');
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(['3.3.3.3:3333', '4.4.4.4:4444', '5.5.5.5:5555'].sort(),
					pns._inProgress[reqId].discoveredPeers.sort());
			test.done();
		},
		
		"when leafset is not empty in pns leafset response, should initiate round trip probes" : function(test) {						
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333',
						'123456' : '4.4.4.4:4444'
					}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(!this.success.called);
			test.equal(3, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '4.4.4.4', '4444'));
			test.ok(0 < pns._inProgress[reqId].leafset_probes['ABCDEF']);
			test.ok(0 < pns._inProgress[reqId].leafset_probes['123456']);
			test.done();
		}
	}),
	
	"handling leafset round trip probe message" : testCase({
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
		},
		
		"when a rtt probe request is received and contains probe_id, resonse content should contain that probe_id" : function(test) {
			this.msg.content.probe_id = 'moo';

			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : 'reqid', probe_id : 'moo'}, {method : 'POST'}, '1.1.1.1', '1111'));			
			test.done();
		}
	}),
	
	"handling leafset round trip probe response message" : testCase({
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

		"when req id in rtt probe response is unknown, do nothing" : function(test) {
			this.msg.content.req_id = 'unknown';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(0, this.sendToAddr.callCount);
			test.done();
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
			test.equal(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when the first rtt probe response is further than current best, report it and finish up" : function(test) {
			var success = sinon.stub();
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success);
			pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			pns._inProgress[reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1
			};
			this.msg.content.req_id = reqId;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(3, this.sendToAddr.callCount);
			test.deepEqual(success.args[0][0], {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1,
				discovered_peers : ['9.9.9.9:9999', '3.3.3.3:3333'],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(pns._inProgress).length);						
			test.done();
		},
		
		"when an unexpected or later leafset rtt probe response is received, throw it away" : function(test) {
			var reqId = pns.findNearestNode('2.2.2.2:2222');
			pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			this.msg.content.req_id = reqId;			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.source_id = '734F';
			this.msginfo.source_ap = '9.9.9.9';
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, pns._inProgress[reqId].leafset_probes);
			test.equal('C105357', pns._inProgress[reqId].nearest.id);
			test.ok(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));		
			test.ok(!this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : reqId,
				depth : 10
			}, {method : 'GET'}, '9.9.9.9', '9999'));
			test.done();
		},
	}),
	
	"handling routing row request message" : testCase({
		setUp : function(done) {
			node.nodeId = '2222222222222222222222222222222222222222';
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			this.msg = {
					method : 'GET',
					uri : 'p2p:graviti/pns/routingrow',
					source_id : '134F5E7',
					content : {
						req_id : 'moo',
						depth : 10
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
			routingtable._table = {};
			sinon.collection.restore();
			done();
		},
		
		"when routing row request received for empty routing table, return empty row and zero depth" : function(test) {
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : 'moo',
				routing_row : {},
				depth : 0
			}, {method : 'POST'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when routing row request received without depth, return empty row and zero depth" : function(test) {
			routingtable.updateWithKnownGood('2221111111111111111111111111111111111111', '5.5.5.5:5555');
			this.msg.content.depth = undefined;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : 'moo',
				routing_row : {},
				depth : 0
			}, {method : 'POST'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when routing row request for non-empty routing table without required row, return next highest available row" : function(test) {
			routingtable.updateWithKnownGood('2211111111111111111111111111111111111111', '4.4.4.4:4444');
			routingtable.updateWithKnownGood('2222211111111111111111111111111111111111', '6.6.6.6:6666');
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : 'moo',
				routing_row : {
					'1' : {
						id : '2222211111111111111111111111111111111111',
						ap : '6.6.6.6:6666',
						rtt: 10000
					}
				},
				depth : 5
			}, {method : 'POST'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when routing row request for non-empty routing table with required row, return that row" : function(test) {
			routingtable.updateWithKnownGood('2211111111111111111111111111111111111111', '4.4.4.4:4444');
			routingtable.updateWithKnownGood('2221111111111111111111111111111111111111', '5.5.5.5:5555');
			routingtable.updateWithKnownGood('2222222222111111111111111111111111111111', '6.6.6.6:6666');
			routingtable.updateWithKnownGood('2222222222211111111111111111111111111111', '7.7.7.7:7777');
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : 'moo',
				routing_row : {
					'1' : {
						id : '2222222222111111111111111111111111111111',
						ap : '6.6.6.6:6666',
						rtt: 10000
					}
				},
				depth : 10
			}, {method : 'POST'}, '3.3.3.3', '3333'));			
			test.done();
		}
	}),
	
	"handling routing row response message" : testCase({
		setUp : function(done) {
			sinon.collection.stub(id, 'generateUuid').returns('generated-uuid');
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			this.msg = {
					method : 'POST',
					uri : 'p2p:graviti/pns/routingrow',
					source_id : '76543210',
					content : {
						req_id : 'moo',
						depth : 7,
						routing_row : {
							'6' : {id : '6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF', ap : '5.5.5.5:5555'},
							'F' : {id : 'FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876', ap : '6.6.6.6:6666'}
						}
					}
			};
			this.msginfo = {
					source_ap : '4.4.4.4:4444'
			}
			pns.init(this.overlayCallback);
			
			done();
		},
		
		tearDown : function(done) {
			pns._inProgress = {};
			routingtable._table = {};
			sinon.collection.restore();
			done();
		},
		
		"when no routing row is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var success = sinon.stub();
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success);
			pns._inProgress[reqId].nearest = { id : '1EAF5E7', ap : '2.2.2.2:2222'	};
			this.msg.content.req_id = reqId;
			delete this.msg.content.routing_row;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(success.args[0][0], {
				id : '1EAF5E7',
				ap : '2.2.2.2:2222',
				rtt : pns.rttWhenInsufficientPeers,
				discovered_peers : [],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(pns._inProgress).length);
			test.done();
		},
		
		"when empty routing row is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var success = sinon.stub();
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success);
			pns._inProgress[reqId].nearest = { id : '1EAF5E7', ap : '2.2.2.2:2222'	};
			this.msg.content.req_id = reqId;
			this.msg.content.routing_row = {};
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(success.args[0][0], {
				id : '1EAF5E7',
				ap : '2.2.2.2:2222',
				rtt : pns.rttWhenInsufficientPeers,
				discovered_peers : [],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(pns._inProgress).length);
			test.done();
		},
		
		"when routing row contains the joining node, disregard that peer" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId);
			this.msg.content.req_id = reqId;
			this.msg.content.routing_row = {
				'1' : {id : joiningNodeId, ap : '5.5.5.5:5555'},
				'F' : {id : 'FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876', ap : '6.6.6.6:6666'}
			};
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(6, pns._inProgress[reqId].depth);
			test.equal(2, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '6.6.6.6', '6666'));
			test.ok(0 < pns._inProgress[reqId].routing_row_probes['generated-uuid']['FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876']);
			test.done();
		},
		
		"when routing row is not empty in pns leafset response, should initiate round trip probes" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222');
			this.msg.content.req_id = reqId;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(6, pns._inProgress[reqId].depth);
			test.equal(3, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '5.5.5.5', '5555'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '6.6.6.6', '6666'));
			test.ok(0 < pns._inProgress[reqId].routing_row_probes['generated-uuid']['6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF']);
			test.ok(0 < pns._inProgress[reqId].routing_row_probes['generated-uuid']['FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876']);
			test.done();
		},
		
		"when zeroth routing row received in pns leafset response, should initiate round trip probes without decrementing depth" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222');
			this.msg.content.req_id = reqId;
			this.msg.content.depth = 0;
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(0, pns._inProgress[reqId].depth);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '5.5.5.5', '5555'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '6.6.6.6', '6666'));
			test.ok(0 < pns._inProgress[reqId].routing_row_probes['generated-uuid']['6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF']);
			test.ok(0 < pns._inProgress[reqId].routing_row_probes['generated-uuid']['FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876']);
			test.done();
		},
		
		"track routing row nodes as discovered nodes for current request, eliminating duplicates and seed node" : function(test) {			
			var reqId = pns.findNearestNode('2.2.2.2:2222');
			this.msg.content.req_id = reqId;			
			this.msg.content.routing_row = {
				'6' : {id : '6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF', ap : '5.5.5.5:5555'},
				'A' : {id : 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ap : '2.2.2.2:2222'},	// expect this one to be thrown away as its the seed node
				'F' : {id : 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', ap : '6.6.6.6:6666'},
				'F' : {id : 'FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876', ap : '7.7.7.7:7777'}	// expect this one to also be discarded as it is seeds public ip
			};
			pns._inProgress[reqId].discoveredPeers.push('6.6.6.6:6666');
			pns._inProgress[reqId].publicSeedAp = '7.7.7.7:7777';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(['5.5.5.5:5555', '6.6.6.6:6666'].sort(),
					pns._inProgress[reqId].discoveredPeers.sort());
			test.done();
		},
	}),
	
	"handling routing row round trip probe response message" : testCase({
		setUp : function(done) {
			sinon.collection.stub(id, 'generateUuid').returns('generated-uuid');
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.overlayCallback, 'sendToAddr');
			this.success = sinon.stub();
			
			pns.init(this.overlayCallback);			
			this.reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			pns._sendRoutingRowProbes(this.reqId, {
					'7' : { id :'734F', ap : '9.9.9.9:9999'},
					'C' : { id : 'C105357', ap : '3.3.3.3:3333' }
			});
			this.msg = {
					method : 'POST',
					uri : 'p2p:graviti/pns/rttprobe',
					source_id : 'C105357',
					content : {
						req_id : this.reqId,
						probe_id : 'generated-uuid'
					}
			};
			this.msginfo = {
					source_ap : '3.3.3.3:3333'
			}			
			
			done();
		},
		
		tearDown : function(done) {
			pns._inProgress = {};
			sinon.collection.restore();
			done();
		},
		
		"when req id in response not known, do nothing" : function(test) {			
			this.msg.content.req_id = 'some-other-req-id';
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(3, this.sendToAddr.callCount);
			test.ok(!this.success.called);
			test.done();
		},
		
		"when the routing row rtt probe response is further than current best, report it and finish up" : function(test) {			
			pns._inProgress[this.reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1
			};
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(3, this.sendToAddr.callCount);
			test.deepEqual(this.success.args[0][0], {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1,
				discovered_peers : ['9.9.9.9:9999', '3.3.3.3:3333'],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(pns._inProgress).length);						
			test.done();
		},
		
		"when the routing row rtt probe response is nearer than current best, store it and initiate another cycle" : function(test) {			
			pns._inProgress[this.reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : 100000
			};
			
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, pns._inProgress[this.reqId].routing_row_probes['generated-uuid']);
			test.equal('C105357', pns._inProgress[this.reqId].nearest.id);
			test.equal(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : this.reqId,
				depth : 10
			}, {method : 'GET'}, '3.3.3.3', '3333'));						
			test.done();
		},
		
		"when an unexpected routing row rtt probe response is received, throw it away" : function(test) {						
			this.msg.content.probe_id = 'some-other-uuid';
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.content.probe_id = 'generated-uuid';
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, pns._inProgress[this.reqId].routing_row_probes['generated-uuid']);
			test.equal('C105357', pns._inProgress[this.reqId].nearest.id);
			test.ok(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : this.reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.done();
		},
		
		"when a late routing row rtt probe response is received, throw it away" : function(test) {									
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.source_id = '734F';
			this.msginfo.source_ap = '9.9.9.9';
			this.overlayCallback.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, pns._inProgress[this.reqId].routing_row_probes['generated-uuid']);
			test.equal('C105357', pns._inProgress[this.reqId].nearest.id);
			test.ok(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : this.reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.done();
		},		
	}),
	
	"reporting success" : testCase({
		setUp : function(done) {
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			pns.nearestNodeSearchTimeoutMsec = 50;
			pns.init(this.overlayCallback);
			this.success = sinon.stub();
			this.error = sinon.stub();
			this.reqId = pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success, this.error);
			
			done();
		},
		
		tearDown : function(done) {
			pns.nearestNodeSearchTimeoutMsec = 20000;
			pns._inProgress = {};
			done();
		},
		
		"on success, cancel timeout timer" : function(test) {
			var _this = this;
			
			pns._reportSuccess(this.reqId, 'nodeid', 'nodeaddrport', 123);
			
			setTimeout(function() {
				test.deepEqual(_this.success.args[0][0], {
					id : 'nodeid',
					ap : 'nodeaddrport',
					rtt : 123,
					discovered_peers : [],
					public_seed_ap: undefined
				});				
				test.ok(!_this.error.called);
				test.done();
			}, 100);
		}
	})
}