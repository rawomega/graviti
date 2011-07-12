var sinon = require('sinon');
var heartbeater = require('overlay/heartbeater');
var leafset = require('core/leafset');
var routingtable = require('core/routingtable');
var langutil = require('common/langutil');
var events = require('events');
var node = require('core/node');
var testCase = require('nodeunit').testCase;

module.exports = {
	"startup" : testCase({
		setUp : function(done) {
			this.overlayCallback = { on : function() {}, removeListener : function() {} };
			this.on = sinon.collection.stub(this.overlayCallback, 'on');			
			
			done();
		},
		
		tearDown : function(done) {
			heartbeater.stop();
			routingtable._table = {};
			leafset.reset();
			sinon.collection.restore();
			done();
		},
		
		"should set up received message listening when starting heartbeater" : function(test) {			
			heartbeater.start(this.overlayCallback);
			
			test.ok(this.on.calledWith('graviti-message-received', heartbeater._handleReceivedGravitiMessage));
			test.done();
		}
	}),

	"stopping" : testCase({
		setUp : function(done) {
			node.nodeId = '9876543210987654321098765432109876543210';
			
			this.overlayCallback = langutil.extend(new events.EventEmitter(), { sendToAddr : function() {} });
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			this.lsClear = sinon.collection.stub(leafset, 'clearExpiredDeadAndCandidatePeers');
			this.rtHousekeep = sinon.collection.stub(routingtable, 'housekeep');
			this.rtEachCandidate = sinon.collection.stub(routingtable, 'eachCandidate');
			this.rtEachRow = sinon.collection.stub(routingtable, 'eachRow');
			done();
		},
		
		tearDown : function(done) {
			leafset.reset();
			sinon.collection.restore();
			done();
		},
		
		"should remove listener after stopping" : function(test) {
			var _this = this;
			var cbk = sinon.collection.stub(heartbeater, '_handleReceivedGravitiMessage');
			heartbeater.start(this.overlayCallback);

			this.overlayCallback.emit('graviti-message-received', 'boo');			
			heartbeater.stop();
			
			_this.overlayCallback.emit('graviti-message-received', 'baa');
			test.ok(cbk.calledOnce);
			test.ok(cbk.calledWith('boo'));
			test.done();
		},
		
		"should not invoke timed tasks after stopping" : function(test) {
			var _this = this;
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			heartbeater.timedOutPeerCheckIntervalMsec = 50;
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			heartbeater.start(this.overlayCallback);
			
			heartbeater.stop();
			
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
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.start(this.overlayCallback);
			
			heartbeater.stop();
			
			test.ok(this.sendToAddr.calledWith('p2p:graviti/peers/9876543210987654321098765432109876543210', undefined, {method : 'DELETE'}, '127.0.0.1', '8888'));
			test.ok(this.sendToAddr.calledWith('p2p:graviti/peers/9876543210987654321098765432109876543210', undefined, {method : 'DELETE'}, '127.0.0.1', '9999'));
			test.done();
		},
		
		"should not send parting messages to leafset peers on stopping if notify peers flag disabled" : function(test) {
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.start(this.overlayCallback);
			
			heartbeater.stop(false);
			
			test.ok(!this.sendToAddr.called);
			test.done();
		}
	}),

	"sending heartbeat messages to leafset peers" : testCase({
		setUp : function(done) {
			this.origNow = Date.now;
			this.overlayCallback = { on : function() {}, sendToAddr : function() {}, removeListener : function() {} };
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			
			Date.now = function() { return 234; };
			
			done();
		},
		
		tearDown : function(done) {
			heartbeater.stop();
			routingtable._table = {};
			leafset.reset();
			sinon.collection.restore();
			Date.now = this.origNow;
			done();
		},
		
		"should send heartbeat to leafset nodes shortly after startup" : function(test) {
			var _this = this;
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);

			setTimeout(function() {
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
						leafset : leafset.compressedLeafset(),
						rsvp_with : 234
					});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[0][4], '8888');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
						leafset : leafset.compressedLeafset(),
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
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			
			heartbeater.heartbeatIntervalMsec = 1000;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			setTimeout(function() {
				test.ok(leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent > (Date.now() - 1000));
				test.ok(leafset._leafset['1234567890123456789012345678901234567890'].lastHeartbeatSent > (Date.now() - 1000));
				test.ok(_this.sendToAddr.calledTwice);
				test.done();
			}, 200);
		},
		
		"should not send heartbeats when interval since last heartbeat not reached" : function(test) {
			var _this = this;
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent = Date.now();
			leafset._leafset['1234567890123456789012345678901234567890'].lastHeartbeatSent = Date.now();
			
			heartbeater.heartbeatIntervalMsec = 1000;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			setTimeout(function() {
				test.ok(!_this.sendToAddr.called);
				test.done();
			}, 200);
		},
		
		"should send heartbeat to candidateset peers and update last sent time" : function(test) {
			var _this = this;
			leafset.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset.updateWithProvisional('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.heartbeatIntervalMsec = 50;
			heartbeater.heartbeatCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			test.equal(2, Object.keys(leafset._candidateset).length);
			setTimeout(function() {
				test.strictEqual(_this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[0][1], {
					leafset : leafset.compressedLeafset(),
					rsvp_with : 234
				});
				test.deepEqual(_this.sendToAddr.args[0][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[0][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[0][4], '8888');
				
				test.strictEqual(_this.sendToAddr.args[1][0], 'p2p:graviti/heartbeat');
				test.deepEqual(_this.sendToAddr.args[1][1], {
						leafset : leafset.compressedLeafset(),
						rsvp_with : 234
					});
				test.deepEqual(_this.sendToAddr.args[1][2], {method : 'POST'});
				test.strictEqual(_this.sendToAddr.args[1][3], '127.0.0.1');
				test.strictEqual(_this.sendToAddr.args[1][4], '9999');
				
				test.ok(leafset._candidateset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent > (Date.now() - 1000));
				test.ok(leafset._candidateset['1234567890123456789012345678901234567890'].lastHeartbeatSent > (Date.now() - 1000));
				test.done();
			}, 200);
		}
	}),
	
	"sending probe heartbeats to routing table peers" : testCase({
		setUp : function(done) {
			this.sharedRow = {'ABCD' : '1.2.3.4:5678'};
			sinon.collection.stub(routingtable, 'getSharedRow').returns(this.sharedRow);
			this.overlayCallback = { on : function() {}, sendToAddr : function() {}, removeListener : function() {} };
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			this.origNow = Date.now;
			Date.now = function() { return 234; };
			
			done();
		},
		
		tearDown : function(done) {
			Date.now = this.origNow;
			heartbeater.stop();
			leafset.reset();
			sinon.collection.restore();
			routingtable._table = {};
			routingtable._candidatePeers = {};
			done();
		},
		
		"should send probe heartbeats to routing candidate peers and update sent time" : function(test) {
			var _this = this;
			routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			routingtable.updateWithProvisional('1234567890123456789012345678901234567890','127.0.0.1:9999');
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			test.equal(2, Object.keys(routingtable._candidatePeers).length);
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
				
				test.ok(routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt > (Date.now() - 1000));
				test.ok(routingtable._candidatePeers['1234567890123456789012345678901234567890'].lastProbedAt > (Date.now() - 1000));
				test.done();
			}, 200);
		},
		
		"should not send probe heartbeats to routing candidate peers that have recently been probed" : function(test) {
			var _this = this;
			routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = 123;
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			setTimeout(function() {
				test.ok(!_this.sendToAddr.called);
				test.done();
			}, 200);
		}
	}),

	"performing routing table maintenance" : testCase({
		setUp : function(done) {
			node.nodeId = '9876543210987654321098765432109876543210';
			this.sharedRow = {'ABCD' : '1.2.3.4:5678'};
			sinon.collection.stub(routingtable, 'getSharedRow').returns(this.sharedRow);
			this.overlayCallback = { on : function() {}, sendToAddr : function() {}, removeListener : function() {} };
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			
			this.origNow = Date.now;
			Date.now = function() { return 234; };
			
			done();
		},
		
		tearDown : function(done) {
			Date.now = this.origNow;
			heartbeater.stop();
			leafset.reset();
			routingtable._table = {};			
			sinon.collection.restore();
			done();
		},

		"routing maintenance should be a timed task that picks a random peer from each row and sends it a heartbeat" : function(test) {
			var _this = this;
			routingtable.updateWithKnownGood('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:1111', 1);
			routingtable.updateWithKnownGood('1234567890123456789012345678901234567890','127.0.0.1:2222', 2);
			routingtable.updateWithKnownGood('9234567890123456789012345678901234567890','127.0.0.1:3333', 3);
			heartbeater.routingTableCandidateCheckIntervalMsec = 50;
			heartbeater.routingTableMaintenanceIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			setTimeout(function() {
				test.ok(Object.keys(routingtable._candidatePeers).length >= 2);
				
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
			this.overlayCallback = {on : function() {}, sendToAddr : function() {}, removeListener : function() {}};			
			heartbeater.heartbeatCheckIntervalMsec = 5000;
			done();
		},
		
		tearDown : function(done) {
			heartbeater.stop();
			leafset.reset();
			sinon.collection.restore();
			done();
		},
		
		"should detect timed out peer in leafset and purge" : function(test) {
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatReceived = (Date.now() - 1000000);
			leafset._leafset['1234567890123456789012345678901234567890'].lastHeartbeatReceived = (Date.now() - 1000000);			
			heartbeater.timedOutPeerCheckIntervalMsec = 50;
			
			heartbeater.start(this.overlayCallback);
			
			setTimeout(function() {
				test.ok(leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'] === undefined);
				test.ok(leafset._leafset['1234567890123456789012345678901234567890'] === undefined);
				test.done();
			}, 200);
		},
		
		"should remove timed out dead peers regularly" : function(test) {
			var lsClearCandidates = sinon.collection.stub(leafset, 'clearExpiredDeadAndCandidatePeers');
			var lsClearTimedOut = sinon.collection.stub(leafset, 'clearTimedOutPeers');			
			var rtHousekeep = sinon.collection.stub(routingtable, 'housekeep');			
			
			heartbeater.start(this.overlayCallback);
			
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
		
			this.lsUpdateWithProvisional = sinon.collection.stub(leafset, 'updateWithProvisional');
			this.lsUpdateWithKnownGood = sinon.collection.stub(leafset, 'updateWithKnownGood');
			this.rtUpdateWithKnownGood = sinon.collection.stub(routingtable, 'updateWithKnownGood');			
			this.rtMergeProvisional = sinon.collection.stub(routingtable, 'mergeProvisional');
			this.overlayCallback = { sendToAddr : function() {}, on : function() {}, removeListener : function() {} };
			this.sendToAddr = sinon.collection.stub(this.overlayCallback, 'sendToAddr');
			this.sharedRow = {'ABCD' : '1.2.3.4:5678'};
			sinon.collection.stub(routingtable, 'getSharedRow').returns(this.sharedRow);
			
			heartbeater.start(this.overlayCallback);			
			done();
		},
		
		tearDown : function(done) {
			leafset.reset();
			sinon.collection.restore();
			routingtable._candidatePeers = {};
			routingtable._table = {};
			Date.now = this.origNow;
			done();
		},

		"update leafset and routing table with details of source node on receiving a heartbeat" : function(test) {
			var rtUpdateWithProvisional = sinon.collection.stub(routingtable, 'updateWithProvisional');
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.lsUpdateWithKnownGood.calledWith('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123', '127.0.0.1:5678'));
			test.ok(rtUpdateWithProvisional.calledWith('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123', '127.0.0.1:5678'));
			test.done();
		},
		
		"update leafset on receipt of heartbeat with leafset data" : function(test) {
			delete this.msg.content.routing_table;
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.lsUpdateWithProvisional.calledWith({a:'b'}));
			test.done();
		},
		
		"update routing table on receipt of heartbeat with leafset data" : function(test) {
			delete this.msg.content.leafset;
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.rtMergeProvisional.calledWith({c:'d'}));
			test.done();
		},
		
		"respond to received heartbeat immediately if requested by unknown peer" : function(test) {
			var _this = this;
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.msg.content.rsvp_with = 6789;			
			this.msg.source_id = '0000000000000000000000000000000000000000';
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
			test.deepEqual(this.sendToAddr.args[0][1], {
				leafset : leafset.compressedLeafset(),
				routing_table : _this.sharedRow,
				rsvp_echo : 6789
			});
			test.deepEqual(this.sendToAddr.args[0][2], {method : 'POST'});
			test.strictEqual(this.sendToAddr.args[0][3], '127.0.0.1');
			test.strictEqual(this.sendToAddr.args[0][4], '5678');			
			test.done();
		},
		
		"respond to received heartbeat immediately if requested by known peer" : function(test) {
			var _this = this;
			leafset._put('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			leafset._put('1234567890123456789012345678901234567890','127.0.0.1:9999');
			this.msg.content.rsvp_with = 6789;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(this.sendToAddr.calledOnce);
			test.strictEqual(this.sendToAddr.args[0][0], 'p2p:graviti/heartbeat');
			test.deepEqual(this.sendToAddr.args[0][1], {
				leafset : leafset.compressedLeafset(),
				routing_table : _this.sharedRow,
				rsvp_echo : 6789
			});
			test.deepEqual(this.sendToAddr.args[0][2], {method : 'POST'});
			test.strictEqual(this.sendToAddr.args[0][3], '127.0.0.1');
			test.strictEqual(this.sendToAddr.args[0][4], '5678');
			test.ok(leafset._leafset['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastHeartbeatSent > 0);
			test.done();
		},
		
		"when probe heartbeat response received with correct echo, update routing table with node details and round trip time" : function(test) {
			routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = 222;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			this.msg.content.rsvp_echo = 222;
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(!this.sendToAddr.called);
			test.ok(this.rtUpdateWithKnownGood.calledOnce);
			test.strictEqual(this.rtUpdateWithKnownGood.args[0][0], 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123');
			test.strictEqual(this.rtUpdateWithKnownGood.args[0][1], '127.0.0.1:5678');
			test.strictEqual(this.rtUpdateWithKnownGood.args[0][2], 234 - 222);
			test.done();
		},
		
		"when probe heartbeat response received with different echo, do not update routing table" : function(test) {
			routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = 222;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			this.msg.content.rsvp_echo = 333;
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(!this.sendToAddr.called);
			test.ok(!this.rtUpdateWithKnownGood.called);
			test.done();
		},
		
		"when probe heartbeat response received from node not being probed, do not update routing table" : function(test) {
			routingtable.updateWithProvisional('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123','127.0.0.1:8888');
			routingtable._candidatePeers['ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'].lastProbedAt = undefined;
			this.msg.source_id = 'ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123';
			this.msg.content.rsvp_echo = 222;
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
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
			done();
		},
		
		tearDown : function(done) {
			leafset.reset();
			sinon.collection.restore();
			done();
		},

		"update leafset and routing table on receipt of peer departure" : function(test) {
			var removePeer = sinon.collection.stub(leafset, "removePeer");
			
			heartbeater._handleReceivedGravitiMessage(this.msg, this.msginfo);
			
			test.ok(removePeer.calledWith('ABCDEF0123ABCDEF0123ABCDEF0123ABCDEF0123'));
			test.done();
		}
	})
};