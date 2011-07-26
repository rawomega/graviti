var sinon = require('sinon');
var testCase = require('nodeunit').testCase;
var pns = require('pastry/pns');
var leafset = require('pastry/leafset');
var routingtable = require('pastry/routingtable');
var ringutil = require('ringutil');
var transport = require('transport');
var langutil = require('langutil');
var mockutil = require('testability/mockutil');

var joiningNodeId = '1014149403101414940310141494031014149403';

module.exports = {
	"pns run execution" : testCase({
		setUp : function(done) {
			var numCallbacks = 0;
			var _this = this;
			this.res = {
					id : 'A00' + numCallbacks,
					ap : '1.1.1.' + numCallbacks + ':1111',
					rtt: 100 * numCallbacks,
					discovered_peers : ['other', 'peers']
				};
			this.success = sinon.stub();
			
			this.transport = mockutil.stubProto(transport.TransportStack);
			this.transport.nodeId = 'ABCDEF';
			this.leafset = mockutil.stubProto(leafset.Leafset);
			this.routingtable = mockutil.stubProto(routingtable.RoutingTable);
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
			this.pns = new pns.Pns(this.transport, this.leafset, this.routingtable);
			this.pnsFind = sinon.collection.stub(this.pns, 'findNearestNode', function(seed, nodeId, success) {
				success(_this.res);
			});
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should initiate pns by starting the first pns run" : function(test) {
			this.pns.run('seed', this.success);
			
			test.ok(this.pnsFind.calledWith('seed', 'ABCDEF'));
			test.done();
		},
		
		"should do no more than max allowed num of finds in a pns run" : function(test) {
			this.pns.run('seed', this.success);
			
			test.equal(3, this.pnsFind.callCount);
			test.ok(this.success.calledWith('1.1.1.0:1111'));
			test.done();
		},
		
		"should only run once if no discovered peers" : function(test) {
			this.res.discovered_peers = [];
			
			this.pns.run('seed', this.success);
			
			test.equal(1, this.pnsFind.callCount);
			test.ok(this.success.calledWith('1.1.1.0:1111'));
			test.done();
		},
		
		"should only run once if discovered empty" : function(test) {
			this.res.discovered_peers = undefined;
			
			this.pns.run('seed', this.success);
			
			test.equal(1, this.pnsFind.callCount);
			test.ok(this.success.calledWith('1.1.1.0:1111'));
			test.done();
		},
		
		"should use up discovered peers only once" : function(test) {
			this.pns.run('seed', this.success);

			test.ok(this.pnsFind.calledWith('other', 'ABCDEF'));
			test.ok(this.pnsFind.calledWith('peers', 'ABCDEF'));	
			test.done();
		},
		
		"should randomize selection of seed from discovered peers from a prevoius run" : function(test) {
			this.res.discovered_peers = ['a', 'b', 'c'];
						
			while (!this.pnsFind.calledWith('a', 'ABCDEF') ||
					!this.pnsFind.calledWith('b', 'ABCDEF') ||
					!this.pnsFind.calledWith('c', 'ABCDEF'))
				this.pns.run('seed', this.success);
			
			test.done();
		}
	}),
		
	"initiating single pns nearest node search" : testCase({
		setUp : function(done) {
			this.transport = mockutil.stubProto(transport.TransportStack);
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
			this.pns = new pns.Pns(this.transport);
			
			done();
		},
		
		tearDown : function(done) {
			this.pns.nearestNodeSearchTimeoutMsec = 20000;
			sinon.collection.restore();
			done();
		},
		
		"sholud store state when initiating search for nearest node" : function(test) {			
			var success = sinon.stub();
			var error = sinon.stub();

			var res = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success, error);
			
			test.equal('2.2.2.2', this.pns._inProgress[res].addr);
			test.equal('2222', this.pns._inProgress[res].port);
			test.equal(success, this.pns._inProgress[res].success);
			test.equal(error, this.pns._inProgress[res].error);
			test.done();
		},
		
		"sholud initiate search for nearest node by sending a requrest for leafset" : function(test) {			
			var res = this.pns.findNearestNode('2.2.2.2:2222');
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/leafset', {req_id : res}, {method : 'GET'}, '2.2.2.2', '2222'));
			test.done();
		},
		
		"should cancel search for nearest node if not completed within given interval" : function(test) {
			var self = this;
			var error = sinon.stub();
			this.pns.nearestNodeSearchTimeoutMsec = 100;
			
			var res = self.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, undefined, error);
			setTimeout(function() {
				test.equal(0, Object.keys(self.pns._inProgress).length);
				test.ok(error.called);
				test.done();
			}, 200);
		}
	}),

	"cancelling all pns node searches" : testCase({
		setUp : function(done) {
			this.transport = mockutil.stubProto(transport.TransportStack);			
			this.pns = new pns.Pns(this.transport);
			
			done();
		},
		
		tearDown : function(done) {
			this.pns.nearestNodeSearchTimeoutMsec = 20000;
			done();
		},
		
		"should throw away all state when PNS search cancelled" : function(test) {			
			var res = this.pns.findNearestNode('2.2.2.2:2222');
			
			this.pns.cancelAll();
			
			test.equal(0, Object.keys(this.pns._inProgress).length);
			test.done();
		},
		
		"should stop all timers when PNS search cancelled" : function(test) {
			this.pns.nearestNodeSearchTimeoutMsec = 100;
			var error = sinon.stub();
			var res = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, undefined, error);
			
			this.pns.cancelAll();
			
			setTimeout(function() {
				test.ok(!error.called);
				test.done();
			}, 200);
		}
	}),

	"handling leafset request message" : testCase({
		setUp : function(done) {
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
			this.leafset = mockutil.stubProto(leafset.Leafset);
			sinon.collection.stub(this.leafset, 'compressedLeafset').returns({ dummy : 'leafset'});
			this.msg = {
					method : 'GET',
					uri : 'p2p:graviti/pns/leafset',
					content : { req_id : 'moo' }
			};
			this.msginfo = {
					source_ap : '1.1.1.1:1111'
			}
			this.pns = new pns.Pns(this.transport, this.leafset);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"sholud respond with leafset upon receipt of pns leafset request" : function(test) {			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/leafset', {
					req_id : 'moo',
					leafset : { dummy : 'leafset'}
				}, {method : 'POST'}, '1.1.1.1', '1111'));
			test.done();
		}
	}),

	"handling leafset response message" : testCase({
		setUp : function(done) {
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
			this.leafset = new leafset.Leafset();
			sinon.collection.stub(this.leafset, 'compressedLeafset').returns({ dummy : 'leafset'});
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
			this.pns = new pns.Pns(this.transport, this.leafset);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"when req id in response not known, do nothing" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : 'some-other-req-id',
					leafset : {}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(1, this.sendToAddr.callCount);
			test.ok(!this.success.called);
			test.done();
		},
		
		"when no leafset is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.success.calledWith({
				id : '1EAF5E7',
				ap : '2.2.2.2:2222',
				rtt : this.pns.rttWhenInsufficientPeers,
				discovered_peers : [],
				public_seed_ap : '2.2.2.2:2222'
			}));
			test.equal(0, Object.keys(this.pns._inProgress).length);
			test.done();
		},
		
		"when leafset contains joining node id, disregard that entry" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333'
					}
			};
			this.msg.content.leafset[joiningNodeId] = '4.4.4.4:4444';
			this.msg.source_id = '1EAF5E7';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(2, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.done();
		},
		
		"track leafset nodes as discovered nodes for current request, without duplicates" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333',
						'123456' : '4.4.4.4:4444',
						'789ABC' : '5.5.5.5:5555'
					}
			};
			this.msg.source_id = '1EAF5E7';
			this.pns._inProgress[reqId].discoveredPeers.push('5.5.5.5:5555');
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(['3.3.3.3:3333', '4.4.4.4:4444', '5.5.5.5:5555'].sort(),
					this.pns._inProgress[reqId].discoveredPeers.sort());
			test.done();
		},
		
		"when leafset is not empty in pns leafset response, should initiate round trip probes" : function(test) {						
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.msg.content = {
					req_id : reqId,
					leafset : {
						'ABCDEF' : '3.3.3.3:3333',
						'123456' : '4.4.4.4:4444'
					}
			};
			this.msg.source_id = '1EAF5E7';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(!this.success.called);
			test.equal(3, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId}, {method : 'GET'}, '4.4.4.4', '4444'));
			test.ok(0 < this.pns._inProgress[reqId].leafset_probes['ABCDEF']);
			test.ok(0 < this.pns._inProgress[reqId].leafset_probes['123456']);
			test.done();
		}
	}),
	
	"handling leafset round trip probe message" : testCase({
		setUp : function(done) {
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
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
			this.pns = new pns.Pns(this.transport);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"when a rtt probe request is received, respond with a simple echo" : function(test) {
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : 'reqid'}, {method : 'POST'}, '1.1.1.1', '1111'));			
			test.done();
		},
		
		"when a rtt probe request is received and contains probe_id, resonse content should contain that probe_id" : function(test) {
			this.msg.content.probe_id = 'moo';

			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : 'reqid', probe_id : 'moo'}, {method : 'POST'}, '1.1.1.1', '1111'));			
			test.done();
		}
	}),
	
	"handling leafset round trip probe response message" : testCase({
		setUp : function(done) {
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
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
			this.pns = new pns.Pns(this.transport);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"when req id in rtt probe response is unknown, do nothing" : function(test) {
			this.msg.content.req_id = 'unknown';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(0, this.sendToAddr.callCount);
			test.done();
		},
		
		"when the first of a series of rtt probe responses is received, store as nearest node and initiate routing table traversal" : function(test) {
			var reqId = this.pns.findNearestNode('2.2.2.2:2222');
			this.pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			this.msg.content.req_id = reqId;
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, this.pns._inProgress[reqId].leafset_probes);
			test.equal('C105357', this.pns._inProgress[reqId].nearest.id);
			test.equal('3.3.3.3:3333', this.pns._inProgress[reqId].nearest.ap);
			test.ok(0 <= this.pns._inProgress[reqId].nearest.rtt);
			test.equal(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when the first rtt probe response is further than current best, report it and finish up" : function(test) {
			var success = sinon.stub();
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success);
			this.pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			this.pns._inProgress[reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1
			};
			this.msg.content.req_id = reqId;
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(3, this.sendToAddr.callCount);
			test.deepEqual(success.args[0][0], {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1,
				discovered_peers : ['9.9.9.9:9999', '3.3.3.3:3333'],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(this.pns._inProgress).length);						
			test.done();
		},
		
		"when an unexpected or later leafset rtt probe response is received, throw it away" : function(test) {
			var reqId = this.pns.findNearestNode('2.2.2.2:2222');
			this.pns._sendLeafsetProbes(reqId, { '734F' : '9.9.9.9:9999', 'C105357' : '3.3.3.3:3333' });
			this.msg.content.req_id = reqId;			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.source_id = '734F';
			this.msginfo.source_ap = '9.9.9.9';
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, this.pns._inProgress[reqId].leafset_probes);
			test.equal('C105357', this.pns._inProgress[reqId].nearest.id);
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
			var nodeId = '2222222222222222222222222222222222222222';
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.transport.nodeId = nodeId;
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
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
			this.routingtable = new routingtable.RoutingTable(nodeId);
			this.pns = new pns.Pns(this.transport, undefined, this.routingtable);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"when routing row request received for empty routing table, return empty row and zero depth" : function(test) {
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : 'moo',
				routing_row : {},
				depth : 0
			}, {method : 'POST'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when routing row request received without depth, return empty row and zero depth" : function(test) {
			this.routingtable.updateWithKnownGood('2221111111111111111111111111111111111111', '5.5.5.5:5555');
			this.msg.content.depth = undefined;
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : 'moo',
				routing_row : {},
				depth : 0
			}, {method : 'POST'}, '3.3.3.3', '3333'));			
			test.done();
		},
		
		"when routing row request for non-empty routing table without required row, return next highest available row" : function(test) {
			this.routingtable.updateWithKnownGood('2211111111111111111111111111111111111111', '4.4.4.4:4444');
			this.routingtable.updateWithKnownGood('2222211111111111111111111111111111111111', '6.6.6.6:6666');
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
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
			this.routingtable.updateWithKnownGood('2211111111111111111111111111111111111111', '4.4.4.4:4444');
			this.routingtable.updateWithKnownGood('2221111111111111111111111111111111111111', '5.5.5.5:5555');
			this.routingtable.updateWithKnownGood('2222222222111111111111111111111111111111', '6.6.6.6:6666');
			this.routingtable.updateWithKnownGood('2222222222211111111111111111111111111111', '7.7.7.7:7777');
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
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
			sinon.collection.stub(ringutil, 'generateUuid').returns('generated-uuid');
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
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
			this.pns = new pns.Pns(this.transport);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"when no routing row is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var success = sinon.stub();
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success);
			this.pns._inProgress[reqId].nearest = { id : '1EAF5E7', ap : '2.2.2.2:2222'	};
			this.msg.content.req_id = reqId;
			delete this.msg.content.routing_row;
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(success.args[0][0], {
				id : '1EAF5E7',
				ap : '2.2.2.2:2222',
				rtt : this.pns.rttWhenInsufficientPeers,
				discovered_peers : [],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(this.pns._inProgress).length);
			test.done();
		},
		
		"when empty routing row is returned in pns leafset response, mark pns search as done and return node" : function(test) {			
			var success = sinon.stub();
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, success);
			this.pns._inProgress[reqId].nearest = { id : '1EAF5E7', ap : '2.2.2.2:2222'	};
			this.msg.content.req_id = reqId;
			this.msg.content.routing_row = {};
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(success.args[0][0], {
				id : '1EAF5E7',
				ap : '2.2.2.2:2222',
				rtt : this.pns.rttWhenInsufficientPeers,
				discovered_peers : [],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(this.pns._inProgress).length);
			test.done();
		},
		
		"when routing row contains the joining node, disregard that peer" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId);
			this.msg.content.req_id = reqId;
			this.msg.content.routing_row = {
				'1' : {id : joiningNodeId, ap : '5.5.5.5:5555'},
				'F' : {id : 'FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876', ap : '6.6.6.6:6666'}
			};
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(6, this.pns._inProgress[reqId].depth);
			test.equal(2, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '6.6.6.6', '6666'));
			test.ok(0 < this.pns._inProgress[reqId].routing_row_probes['generated-uuid']['FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876']);
			test.done();
		},
		
		"when routing row is not empty in pns leafset response, should initiate round trip probes" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222');
			this.msg.content.req_id = reqId;
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(6, this.pns._inProgress[reqId].depth);
			test.equal(3, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '5.5.5.5', '5555'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '6.6.6.6', '6666'));
			test.ok(0 < this.pns._inProgress[reqId].routing_row_probes['generated-uuid']['6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF']);
			test.ok(0 < this.pns._inProgress[reqId].routing_row_probes['generated-uuid']['FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876']);
			test.done();
		},
		
		"when zeroth routing row received in pns leafset response, should initiate round trip probes without decrementing depth" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222');
			this.msg.content.req_id = reqId;
			this.msg.content.depth = 0;
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(0, this.pns._inProgress[reqId].depth);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '5.5.5.5', '5555'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/rttprobe', {req_id : reqId, probe_id : 'generated-uuid'}, {method : 'GET'}, '6.6.6.6', '6666'));
			test.ok(0 < this.pns._inProgress[reqId].routing_row_probes['generated-uuid']['6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF']);
			test.ok(0 < this.pns._inProgress[reqId].routing_row_probes['generated-uuid']['FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876']);
			test.done();
		},
		
		"track routing row nodes as discovered nodes for current request, eliminating duplicates and seed node" : function(test) {			
			var reqId = this.pns.findNearestNode('2.2.2.2:2222');
			this.msg.content.req_id = reqId;			
			this.msg.content.routing_row = {
				'6' : {id : '6789ABCDEF6789ABCDEF6789ABCDEF6789ABCDEF', ap : '5.5.5.5:5555'},
				'A' : {id : 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ap : '2.2.2.2:2222'},	// expect this one to be thrown away as its the seed node
				'F' : {id : 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', ap : '6.6.6.6:6666'},
				'F' : {id : 'FEDCBA9876FEDCBA9876FEDCBA9876FEDCBA9876', ap : '7.7.7.7:7777'}	// expect this one to also be discarded as it is seeds public ip
			};
			this.pns._inProgress[reqId].discoveredPeers.push('6.6.6.6:6666');
			this.pns._inProgress[reqId].publicSeedAp = '7.7.7.7:7777';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.deepEqual(['5.5.5.5:5555', '6.6.6.6:6666'].sort(),
					this.pns._inProgress[reqId].discoveredPeers.sort());
			test.done();
		},
	}),

	"handling routing row round trip probe response message" : testCase({
		setUp : function(done) {
			sinon.collection.stub(ringutil, 'generateUuid').returns('generated-uuid');
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.stub(this.transport, 'sendToAddr');
			this.success = sinon.stub();
			
			this.pns = new pns.Pns(this.transport);			
			this.reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success);
			this.pns._sendRoutingRowProbes(this.reqId, {
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
			sinon.collection.restore();
			done();
		},
		
		"when req id in response not known, do nothing" : function(test) {			
			this.msg.content.req_id = 'some-other-req-id';
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(3, this.sendToAddr.callCount);
			test.ok(!this.success.called);
			test.done();
		},
		
		"when the routing row rtt probe response is further than current best, report it and finish up" : function(test) {			
			this.pns._inProgress[this.reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1
			};
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(3, this.sendToAddr.callCount);
			test.deepEqual(this.success.args[0][0], {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : -1,
				discovered_peers : ['9.9.9.9:9999', '3.3.3.3:3333'],
				public_seed_ap: undefined
			});
			test.equal(0, Object.keys(this.pns._inProgress).length);						
			test.done();
		},
		
		"when the routing row rtt probe response is nearer than current best, store it and initiate another cycle" : function(test) {			
			this.pns._inProgress[this.reqId].nearest = {
				id : '8377371D',
				ap : '2.2.2.2:2222',
				rtt : 100000
			};
			
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, this.pns._inProgress[this.reqId].routing_row_probes['generated-uuid']);
			test.equal('C105357', this.pns._inProgress[this.reqId].nearest.id);
			test.equal(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
				req_id : this.reqId,
				depth : 10
			}, {method : 'GET'}, '3.3.3.3', '3333'));						
			test.done();
		},
		
		"when an unexpected routing row rtt probe response is received, throw it away" : function(test) {						
			this.msg.content.probe_id = 'some-other-uuid';
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.content.probe_id = 'generated-uuid';
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, this.pns._inProgress[this.reqId].routing_row_probes['generated-uuid']);
			test.equal('C105357', this.pns._inProgress[this.reqId].nearest.id);
			test.ok(4, this.sendToAddr.callCount);
			test.ok(this.sendToAddr.calledWith('p2p:graviti/pns/routingrow', {
					req_id : this.reqId,
					depth : 10
				}, {method : 'GET'}, '3.3.3.3', '3333'));
			test.done();
		},
		
		"when a late routing row rtt probe response is received, throw it away" : function(test) {									
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);

			this.msg.source_id = '734F';
			this.msginfo.source_ap = '9.9.9.9';
			this.transport.emit('graviti-message-received', this.msg, this.msginfo);
			
			test.equal(undefined, this.pns._inProgress[this.reqId].routing_row_probes['generated-uuid']);
			test.equal('C105357', this.pns._inProgress[this.reqId].nearest.id);
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
			this.transport = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.pns = new pns.Pns(this.transport);
			this.pns.nearestNodeSearchTimeoutMsec = 50;
			this.success = sinon.stub();
			this.error = sinon.stub();
			this.reqId = this.pns.findNearestNode('2.2.2.2:2222', joiningNodeId, this.success, this.error);
			
			done();
		},
		
		"on success, cancel timeout timer" : function(test) {
			var _this = this;
			
			this.pns._reportSuccess(this.reqId, 'nodeid', 'nodeaddrport', 123);
			
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