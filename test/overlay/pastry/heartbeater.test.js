var sinon = require('sinon');
var heartbeater = require('overlay/pastry/heartbeater');
var leafset = require('overlay/pastry/leafset');
var routingtable = require('overlay/routingtable');
var langutil = require('common/langutil');
var events = require('events');
var node = require('core/node');
var testCase = require('nodeunit').testCase;
var messagemgr = require('messaging/messagemgr');
var mockutil = require('testability/mockutil');
var util = require('util');

module.exports = {
	"creation" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.on = sinon.stub(this.messagemgr, 'on').returns(undefined);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);
			
			done();
		},
		
		"should set up received message listening when created" : function(test) {			
			test.ok(this.on.calledWith('graviti-message-received'));
			test.done();
		}
	}),

	"stopping" : testCase({
		setUp : function(done) {
			node.nodeId = '9876543210987654321098765432109876543210';
			
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();

			this.sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr');
			this.lsClear = sinon.stub(this.leafset, 'clearExpiredDeadAndCandidatePeers');
			this.rtHousekeep = sinon.stub(this.routingtable, 'housekeep');
			this.rtEachCandidate = sinon.stub(this.routingtable, 'eachCandidate');
			this.rtEachRow = sinon.stub(this.routingtable, 'eachRow');

			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);

			done();
		},
		
		"should remove listener after stopping" : function(test) {
			var cbk = sinon.stub(this.messagemgr, 'removeListener');

			this.heartbeater.stop();
			
			test.ok(cbk.calledWith('graviti-message-received', this.heartbeater._handleReceivedGravitiMessage));
			test.done();
		},
		
		"should not invoke timed tasks after stopping" : function(test) {
			var _this = this;
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			heartbeater.timedOutPeerCheckIntervalMsec = 50;
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			this.heartbeater.start();
			
			this.heartbeater.stop();
			
			setTimeout(function() {
				test.ok(_this.sendToAddr.callCount < 2);
				test.ok(_this.lsClear.callCount < 2);
				test.ok(_this.rtHousekeep.callCount < 2);
				test.ok(_this.rtEachCandidate.callCount < 2);
				test.ok(_this.rtEachRow.callCount < 2);
				test.done();
			}, 300);
		},
		
		"should send parting messages to leafset peers on stopping" : function(test) {
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.heartbeater.start();
			
			this.heartbeater.stop();
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/peers/9876543210987654321098765432109876543210', undefined, {method : 'DELETE'}, '127.0.0.1', '8888'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/peers/9876543210987654321098765432109876543210', undefined, {method : 'DELETE'}, '127.0.0.1', '9999'));
			test.done();
		},
		
		"should not send parting messages to leafset peers on stopping if notify peers flag disabled" : function(test) {
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.heartbeater.start();
			
			this.heartbeater.stop(false);
			
			test.ok(!this.sendToAddr.called);
			test.done();
		}
	}),

	"sending heartbeat messages to leafset peers" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);
			
			this.origNow = Date.now;
			this.sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr');			
			Date.now = function() { return 234; };
			
			done();
		},
		
		tearDown : function(done) {
			Date.now = this.origNow;
			done();
		},
		
		"should send heartbeat to leafset nodes shortly after startup" : function(test) {
			var _this = this;
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			this.heartbeater.start();

			setTimeout(function() {
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
						leafset : _this.leafset.compressedLeafset(),
						rsvp_with : 234
					});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[0][4], '8888');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
						leafset : _this.leafset.compressedLeafset(),
						rsvp_with : 234
					});
				test.deepEqual(_this.sendToAddr.args[1][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[1][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[1][4], '9999');
				test.done();
			}, 200);
		},
		
		"should update last heartbeat sent time after sending" : function(test) {
			var _this = this;
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			
			heartbeater.heartbeatIntervalMsec = 1000;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			this.heartbeater.start();
			
			setTimeout(function() {
				test.ok(_this.leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent > (Date.now() - 1000));
				test.ok(_this.leafset._leafset['1234567890123456789012345678901234567890'].lastHeartbeatSent > (Date.now() - 1000));
				test.ok(_this.sendToAddr.calledTwice);
				test.done();
			}, 200);
		},
		
		"should not send heartbeats when interval since last heartbeat not reached" : function(test) {
			var _this = this;
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent = Date.now();
			this.leafset._leafset['1234567890123456789012345678901234567890'].lastHeartbeatSent = Date.now();
			
			heartbeater.heartbeatIntervalMsec = 1000;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			this.heartbeater.start();
			
			setTimeout(function() {
				test.ok(!_this.sendToAddr.called);
				test.done();
			}, 200);
		},
		
		"should send heartbeat to candidateset peers and update last sent time" : function(test) {
			var _this = this;
			this.leafset.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset.updateWithProvisional('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			this.heartbeater.start();
			
			test.equal(2, Object.keys(this.leafset._candidateset).length);
			setTimeout(function() {
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
					leafset : _this.leafset.compressedLeafset(),
					rsvp_with : 234
				});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[0][4], '8888');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
						leafset : _this.leafset.compressedLeafset(),
						rsvp_with : 234
					});
				test.deepEqual(_this.sendToAddr.args[1][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[1][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[1][4], '9999');
				
				test.ok(_this.leafset._candidateset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent > (Date.now() - 1000));
				test.ok(_this.leafset._candidateset['1234567890123456789012345678901234567890'].lastHeartbeatSent > (Date.now() - 1000));
				test.done();
			}, 200);
		}
	}),
	
	"sending probe heartbeats to routing table peers" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);
			
			this.sharedRow = {'ABCD' : '1.2.3.4:5678'};			
			sinon.stub(this.routingtable, 'getSharedRow').returns(this.sharedRow);
			this.sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr');
			this.origNow = Date.now;
			Date.now = function() { return 234; };
			
			done();
		},
		
		tearDown : function(done) {
			Date.now = this.origNow;
			done();
		},
		
		"should send probe heartbeats to routing candidate peers and update sent time" : function(test) {
			var _this = this;
			this.routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.routingtable.updateWithProvisional('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			
			this.heartbeater.start();
			
			test.equal(2, Object.keys(this.routingtable._candidatePeers).length);
			setTimeout(function() {
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
					routing_table : _this.sharedRow,
					rsvp_with : 234
				});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[0][4], '8888');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
					routing_table : _this.sharedRow,
					rsvp_with : 234
				});
				test.deepEqual(_this.sendToAddr.args[1][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[1][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[1][4], '9999');
				
				test.ok(_this.routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt > (Date.now() - 1000));
				test.ok(_this.routingtable._candidatePeers['1234567890123456789012345678901234567890'].lastProbedAt > (Date.now() - 1000));
				test.done();
			}, 200);
		},
		
		"should not send probe heartbeats to routing candidate peers that have recently been probed" : function(test) {
			var _this = this;
			this.routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = 123;
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			
			this.heartbeater.start();
			
			setTimeout(function() {
				test.ok(!_this.sendToAddr.called);
				test.done();
			}, 200);
		}
	}),

	"performing routing table maintenance" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);
			
			node.nodeId = '9876543210987654321098765432109876543210';
			this.sharedRow = {'ABCD' : '1.2.3.4:5678'};
			sinon.stub(this.routingtable, 'getSharedRow').returns(this.sharedRow);
			this.sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr');
			
			this.origNow = Date.now;
			Date.now = function() { return 234; };
			
			done();
		},
		
		tearDown : function(done) {
			Date.now = this.origNow;
			done();
		},

		"routing maintenance should be a timed task that picks a random peer from each row and sends it a heartbeat" : function(test) {
			var _this = this;
			this.routingtable.updateWithKnownGood('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:1111', 1);
			this.routingtable.updateWithKnownGood('1234567890123456789012345678901234567890','127.0.0.1:2222', 2);
			this.routingtable.updateWithKnownGood('9234567890123456789012345678901234567890','127.0.0.1:3333', 3);
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			heartbeater.routingTableMaintenanceIntervalMsec = 50;
			
			this.heartbeater.start();
			
			setTimeout(function() {
				test.ok(Object.keys(_this.routingtable._candidatePeers).length >= 2);
				
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
					routing_table : _this.sharedRow,
					rsvp_with : 234
				});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.ok(_this.sendToAddr.args[0][4] === '1111' || _this.sendToAddr.args[0][4] === '2222');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
					routing_table : _this.sharedRow,
					rsvp_with : 234
				});
				test.deepEqual(_this.sendToAddr.args[1][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[1][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[1][4], '3333');
				
				test.done();
			}, 200);
		}
	}),

	"detecting timed out peers" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);
			
			heartbeater.heartbeatCheckIntervalMsec = 5000;
			done();
		},
		
		"should detect timed out peer in leafset and purge" : function(test) {
			var _this = this;
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatReceived = (Date.now() - 1000000);
			this.leafset._leafset['1234567890123456789012345678901234567890'].lastHeartbeatReceived = (Date.now() - 1000000);			
			heartbeater.timedOutPeerCheckIntervalMsec = 50;
			
			this.heartbeater.start();
			
			setTimeout(function() {
				test.ok(_this.leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'] === undefined);
				test.ok(_this.leafset._leafset['1234567890123456789012345678901234567890'] === undefined);
				test.done();
			}, 200);
		},
		
		"should remove timed out dead peers regularly" : function(test) {
			var lsClearCandidates = sinon.stub(this.leafset, 'clearExpiredDeadAndCandidatePeers');
			var lsClearTimedOut = sinon.stub(this.leafset, 'clearTimedOutPeers');			
			var rtHousekeep = sinon.stub(this.routingtable, 'housekeep');			
			
			this.heartbeater.start();
			
			setTimeout(function() {
				test.ok(lsClearCandidates.called);
				test.ok(lsClearTimedOut.called);
				test.ok(rtHousekeep.called);
				test.done();
			}, 200);
		}
	}),
	
	"handling received heartbeats" : testCase({
		setUp : function(done) {
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);

			this.origNow = Date.now;
			Date.now = function() { return 234; };
			
			this.msg = {
				uri : 'p2p:graviti/heartbeat',
				method : 'POST',
				source_id : 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123',
				content : {
					leafset : {a:'b'},
					routing_table : {c : 'd'}
				}
			};
			this.msginfo = {
					source_ap : '127.0.0.1:5678',
					sender_ap : '127.0.0.1:1234'
			};
		
			this.lsUpdateWithProvisional = sinon.stub(this.leafset, 'updateWithProvisional');
			this.lsUpdateWithKnownGood = sinon.stub(this.leafset, 'updateWithKnownGood');
			this.rtUpdateWithKnownGood = sinon.stub(this.routingtable, 'updateWithKnownGood');			
			this.rtMergeProvisional = sinon.stub(this.routingtable, 'mergeProvisional');
			this.sendToAddr = sinon.stub(this.messagemgr, 'sendToAddr');
			this.sharedRow = {'ABCD' : '1.2.3.4:5678'};
			sinon.stub(this.routingtable, 'getSharedRow').returns(this.sharedRow);
			
			this.heartbeater.start();			
			done();
		},
		
		tearDown : function(done) {
			Date.now = this.origNow;
			done();
		},

		"update leafset and routing table with details of source node on receiving a heartbeat" : function(test) {
			var rtUpdateWithProvisional = sinon.stub(this.routingtable, 'updateWithProvisional');
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.lsUpdateWithKnownGood.calledWith('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123', '127.0.0.1:5678'));
			test.ok(rtUpdateWithProvisional.calledWith('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123', '127.0.0.1:5678'));
			test.done();
		},
		
		"update leafset on receipt of heartbeat with leafset data" : function(test) {
			delete this.msg.content.routing_table;
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.lsUpdateWithProvisional.calledWith({a:'b'}));
			test.done();
		},
		
		"update routing table on receipt of heartbeat with leafset data" : function(test) {
			delete this.msg.content.leafset;
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.rtMergeProvisional.calledWith({c:'d'}));
			test.done();
		},
		
		"respond to received heartbeat immediately if requested by unknown peer" : function(test) {
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.msg.content.rsvp_with = 6789;			
			this.msg.source_id = '0000000000000000000000000000000000000000';
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
			test.deepEqual(this.sendToAddr.args[0][1], {
				leafset : this.leafset.compressedLeafset(),
				routing_table : this.sharedRow,
				rsvp_echo : 6789
			});
			test.deepEqual(this.sendToAddr.args[0][2], {method : 'POST'});
			test.strictEqual(this.sendToAddr.args[0][3], '127.0.0.1');
			test.strictEqual(this.sendToAddr.args[0][4], '5678');			
			test.done();
		},
		
		"respond to received heartbeat immediately if requested by known peer" : function(test) {
			var _this = this;
			this.leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.msg.content.rsvp_with = 6789;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
			test.deepEqual(this.sendToAddr.args[0][1], {
				leafset : this.leafset.compressedLeafset(),
				routing_table : this.sharedRow,
				rsvp_echo : 6789
			});
			test.deepEqual(this.sendToAddr.args[0][2], {method : 'POST'});
			test.strictEqual(this.sendToAddr.args[0][3], '127.0.0.1');
			test.strictEqual(this.sendToAddr.args[0][4], '5678');
			test.ok(this.leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent > 0);
			test.done();
		},
		
		"when probe heartbeat response received with correct echo, update routing table with node details and round trip time" : function(test) {
			this.routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = 222;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			this.msg.content.rsvp_echo = 222;
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(!this.sendToAddr.called);
			test.ok(this.rtUpdateWithKnownGood.calledOnce);
			test.strictEqual(this.rtUpdateWithKnownGood.args[0][0], 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123');
			test.strictEqual(this.rtUpdateWithKnownGood.args[0][1], '127.0.0.1:5678');
			test.strictEqual(this.rtUpdateWithKnownGood.args[0][2], 234 - 222);
			test.done();
		},
		
		"when probe heartbeat response received with different echo, do not update routing table" : function(test) {
			this.routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = 222;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			this.msg.content.rsvp_echo = 333;
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(!this.sendToAddr.called);
			test.ok(!this.rtUpdateWithKnownGood.called);
			test.done();
		},
		
		"when probe heartbeat response received from node not being probed, do not update routing table" : function(test) {
			this.routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			this.routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = undefined;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			this.msg.content.rsvp_echo = 222;
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(!this.sendToAddr.called);
			test.ok(!this.rtUpdateWithKnownGood.called);
			test.done();
		}
	}),
	
	"handling departing peer messages" : testCase({
		setUp : function(done) {
			this.msg = {
				uri : 'p2p:graviti/peers/ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123',
				method : 'DELETE'
			};
			this.msginfo = {
				sender_ap : '127.0.0.1:1234'
			};
			
			this.messagemgr = mockutil.stubProto(messagemgr.MessageMgr);			
			this.leafset = new leafset.Leafset();
			this.routingtable = new routingtable.RoutingTable();
			this.heartbeater = new heartbeater.Heartbeater(this.messagemgr, this.leafset, this.routingtable);
			
			done();
		},

		"update leafset and routing table on receipt of peer departure" : function(test) {
			var removePeer = sinon.stub(this.leafset, "removePeer");
			
			this.heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(removePeer.calledWith('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'));
			test.done();
		}
	})
};