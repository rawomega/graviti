var assert = require('assert');
var leafset = require('overlay/pastry/leafset');
var node = require('core/node');
var sinon = require('sinon');
var testCase = require('nodeunit').testCase;

var myId = '3909DB380AF909E320329511CC932099BAD10094';
var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';

module.exports = {
	"getting individual peer metadata" : testCase ({
		tearDown : function(done) {
			leafset.reset();
			done();
		},
		
		"should be able to get leafset metadata for given peer" : function(test) {
			leafset._put(anId, "1.2.3.4:9012");
			
			var res = leafset.peer(anId);
			
			test.strictEqual("1.2.3.4:9012", res.ap);
			test.ok(res.lastHeartbeatReceived > 0);
			test.done();
		}
	}),
	
	"iterating over leafset" : testCase ({
		tearDown : function(done) {
			leafset.reset();
			done();
		},
		
		"should be able to invoke given anonymous function for each leafset member" : function(test) {
			var callbacks = {};
			leafset._deadset = {};
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");
			
			leafset.each(function(id, item) {
				callbacks[id] = item;
			});
			
			test.equal(2, Object.keys(callbacks).length);
			test.equal('1.2.3.4:1234', callbacks[lowerId].ap);
			test.equal('1.2.3.4:5678', callbacks[higherId].ap);
			test.done();
		},
		
		"should be able to invoke given anonymous function for each candidateset member" : function(test) {
			var callbacks = {};
			leafset._candidateset[lowerId] = {ap : "1.2.3.4:1234"};
			leafset._candidateset[higherId] = {ap : "5.6.7.8:1234"};
			
			leafset.eachCandidate(function(id, item) {
				callbacks[id] = item;
			});
			
			test.equal(2, Object.keys(callbacks).length);
			test.equal('1.2.3.4:1234', callbacks[lowerId].ap);
			test.equal('5.6.7.8:1234', callbacks[higherId].ap);
			test.done();
		}
	}),
	
	"removing elements from the leafset" : testCase ({
		tearDown : function(done) {
			leafset.reset();
			done();
		},
		
		"should be able to remove a single element from the leafset, adding it to 'deadset' and raising event" : function(test) {
			var callback = sinon.stub();
			leafset.on('peer-departed', callback);
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");			
			
			leafset.removePeer(lowerId);
			
			test.strictEqual(1, Object.keys(leafset._leafset).length);
			test.ok(leafset._leafset[higherId] !== undefined);
			test.ok(leafset._leafset[higherId].deadAt === undefined);
			test.strictEqual(1, Object.keys(leafset._deadset).length);
			test.ok(leafset._deadset[lowerId].deadAt > (Date.now() - 10000));
			test.ok(callback.calledWith(lowerId));
			test.done();
		},
		
		"should be able to remove all peers" : function(test) {
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");
			
			leafset.reset();
			
			test.strictEqual(0, Object.keys(leafset._leafset).length);
			test.strictEqual(0, Object.keys(leafset._deadset).length);
			test.strictEqual(0, Object.keys(leafset._candidateset).length);
			test.done();
		},
		
		"should be able to remove a peer in candidate set" : function(test) {
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset.updateWithProvisional(higherId, "1.2.3.4:5678");
			
			leafset.reset();
			
			test.strictEqual(0, Object.keys(leafset._leafset).length);
			test.strictEqual(0, Object.keys(leafset._deadset).length);
			test.strictEqual(0, Object.keys(leafset._candidateset).length);
			test.done();
		},
		
		"should be able to clear all timed out dead candidate peers" : function(test) {
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");			
			leafset.removePeer(lowerId);
			leafset.removePeer(higherId);
			leafset._deadset[lowerId].deadAt = (Date.now() - 100000);
			
			leafset.clearExpiredDeadAndCandidatePeers();
			
			test.strictEqual(1, Object.keys(leafset._deadset).length);
			test.ok(leafset._deadset[lowerId] === undefined);
			test.done();
		},
		
		"should be able to clear all expired candidate peers" : function(test) {
			leafset._candidateset[lowerId] = {foundAt : Date.now() - 100000};
			leafset._candidateset[higherId] = {foundAt : Date.now()};
			
			leafset.clearExpiredDeadAndCandidatePeers();
			
			test.strictEqual(1, Object.keys(leafset._candidateset).length);
			test.ok(leafset._candidateset[lowerId] === undefined);
			test.done();
		},
		
		"should be able to clear all timed out leafset peers" : function(test) {
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");			
			leafset._leafset[lowerId].lastHeartbeatReceived = Date.now() - 100000;
			
			leafset.clearTimedOutPeers();
			
			test.strictEqual(1, Object.keys(leafset._leafset).length);
			test.ok(leafset._leafset[lowerId] === undefined);
			test.done();
		}
	}), 
	
	"updating leafset with known good peers" : testCase ({
		setUp : function(done) {
			node.nodeId = myId;
			this.arrivedCallback = sinon.stub();
			leafset.setMaxListeners(1000);
			leafset.on('peer-arrived', this.arrivedCallback);
			done();
		},
		
		tearDown : function(done) {
			leafset.reset();
			leafset.leafsetSize = 20;
			done();
		},
		
		"should enforce requirement to make leafset size even (temporarily we do that here)" : function(test) {
			leafset.leafsetSize = 3;
			
			assert.throws(function() {
				leafset.updateWithKnownGood('something');				
			}, /leafset size/i);			
			test.done();
		},
		
		"should do nothing to leafset when updating with undefined" : function(test) {			
			leafset.updateWithKnownGood(undefined);
			
			test.equal(0, Object.keys(leafset._leafset).length);
			test.equal(0, Object.keys(leafset._candidateset).length);
			test.done();
		},
		
		"should update empty leafset with known good peer by adding directly and raising event" : function(test) {
			leafset.updateWithKnownGood(anId, '1.2.3.4');
			
			test.equal(1, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[anId].ap);
			test.ok(leafset._leafset[anId].lastHeartbeatReceived > 0);
			test.ok(this.arrivedCallback.calledWith(anId));
			test.done();
		},
		
		"should update empty leafset with known good peer from object and raise event" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			
			leafset.updateWithKnownGood(upd);
			
			test.equal(1, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[anId].ap);
			test.ok(leafset._leafset[anId].lastHeartbeatReceived > 0);
			test.ok(this.arrivedCallback.calledWith(anId));
			test.done();
		},
		
		"should update empty leafset from object with two known good peers at once and raise events" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			upd[higherId] = '2.4.6.8';
			
			leafset.updateWithKnownGood(upd);
			
			test.equal(2, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[anId].ap);
			test.equal('2.4.6.8', leafset._leafset[higherId].ap);
			test.ok(leafset._leafset[anId].lastHeartbeatReceived > 0);
			test.ok(leafset._leafset[higherId].lastHeartbeatReceived > 0);
			test.ok(this.arrivedCallback.calledWith(anId));
			test.ok(this.arrivedCallback.calledWith(higherId));
			test.done();
		},
		
		"should disregaard own node id when updating existing leafset" : function(test) {
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			leafset.updateWithKnownGood(myId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafset._leafset[anId].ap);
			test.equal(1, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafset._leafset[anId].lastHeartbeatReceived);
			test.ok(!this.arrivedCallback.called);
			test.done();
		},
		
		"should update existing leafset by replacing existing known good peer, without raising new peer event" : function(test) {
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1, someExistingValue : 42};
			leafset._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2, anotherExistingValue : 42};
			
			leafset.updateWithKnownGood(anId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('3.4.5.6', leafset._leafset[anId].ap);
			test.equal(1, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.ok(leafset._leafset[anId].lastHeartbeatReceived > 2);
			test.equal(42, leafset._leafset[anId].anotherExistingValue);
			test.ok(!this.arrivedCallback.called);
			test.done();
		},
		
		"should update existing leafset with known good peer by adding and raising event" : function(test) {
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
				
			leafset.updateWithKnownGood(higherId, '6.7.8.9');
			
			test.equal(3, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafset._leafset[anId].ap);
			test.equal('6.7.8.9', leafset._leafset[higherId].ap);
			test.equal(1, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafset._leafset[anId].lastHeartbeatReceived);
			test.ok(leafset._leafset[higherId].lastHeartbeatReceived > 2);
			test.ok(this.arrivedCallback.calledWith(higherId));
			test.done();
		},
		
		"should update existing leafset with known good peers by replacing and adding" : function(test) {
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			var upd = {};
			upd[anId] = '3.4.5.6';
			upd[higherId] = '6.7.8.9';
			
			leafset.updateWithKnownGood(upd);
			
			test.equal(3, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('3.4.5.6', leafset._leafset[anId].ap);
			test.equal('6.7.8.9', leafset._leafset[higherId].ap);
			test.equal(1, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.ok(leafset._leafset[anId].lastHeartbeatReceived > 2);
			test.ok(leafset._leafset[higherId].lastHeartbeatReceived > 2);
			test.ok(this.arrivedCallback.calledWith(higherId));
			test.ok(this.arrivedCallback.calledOnce);
			test.done();
		},
		
		"should resurrect peer in the deadset if it is known good" : function(test) {
			leafset._deadset[anId] = {ap : "1.2.3.4", deadAt : Date.now()};
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			
			leafset.updateWithKnownGood(anId, '2.3.4.5');
			
			test.equal(0, Object.keys(leafset._deadset).length);
			test.equal(2, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafset._leafset[anId].ap);
			test.ok(this.arrivedCallback.calledWith(anId));
			test.done();
		},
		
		"should promote peer in the candidateset if it is known good" : function(test) {
			leafset._candidateset[anId] = {ap : "1.2.3.4"};
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			
			leafset.updateWithKnownGood(anId, '2.3.4.5');
			
			test.equal(0, Object.keys(leafset._candidateset).length);
			test.equal(2, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafset._leafset[anId].ap);
			test.ok(this.arrivedCallback.calledWith(anId));
			test.done();
		},
		
		"should enforce max leafset size when adding closer known good peer in clockwise direction" : function(test) {
			node.nodeId = anId;
			leafset.leafsetSize = 4;
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[oneLessId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafset._leafset[oneMoreId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			leafset._leafset[wrappedId] = { ap : "4.5.6.7", lastHeartbeatReceived : 4};
			
			leafset.updateWithKnownGood(higherId, '5.6.7.8');
			
			test.equal(4, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafset._leafset[oneLessId].ap);
			test.equal('3.4.5.6', leafset._leafset[oneMoreId].ap);
			test.equal('5.6.7.8', leafset._leafset[higherId].ap);
			test.equal(1, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafset._leafset[oneLessId].lastHeartbeatReceived);
			test.equal(3, leafset._leafset[oneMoreId].lastHeartbeatReceived);
			test.ok(leafset._leafset[higherId].lastHeartbeatReceived > 2);
			test.ok(this.arrivedCallback.calledWith(higherId));
			test.done();			
		},
		
		"should enforce max leafset size when adding closer known good peer in counter-clockwise direction" : function(test) {
			node.nodeId = anId;
			leafset.leafsetSize = 4;
			leafset._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[oneMoreId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafset._leafset[higherId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			leafset._leafset[wrappedId] = { ap : "4.5.6.7", lastHeartbeatReceived : 4};
			
			leafset.updateWithKnownGood(oneLessId, '5.6.7.8');
			
			test.equal(4, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafset._leafset[oneMoreId].ap);
			test.equal('3.4.5.6', leafset._leafset[higherId].ap);
			test.equal('5.6.7.8', leafset._leafset[oneLessId].ap);
			test.equal(1, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafset._leafset[oneMoreId].lastHeartbeatReceived);
			test.equal(3, leafset._leafset[higherId].lastHeartbeatReceived);
			test.ok(leafset._leafset[oneLessId].lastHeartbeatReceived > 2);
			test.ok(this.arrivedCallback.calledWith(oneLessId));
			test.done();			
		},
		
		"should do nothing for known good peer that isn't nearer than existing leafset peers" : function(test) {
			node.nodeId = anId;
			leafset.leafsetSize = 4;
			leafset._leafset[oneMoreId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[oneLessId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafset._leafset[higherId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			leafset._leafset[lowerId] = { ap : "4.5.6.7", lastHeartbeatReceived : 4};
			
			leafset.updateWithKnownGood(wrappedId, '5.6.7.8');
			
			test.equal(4, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[oneMoreId].ap);
			test.equal('2.3.4.5', leafset._leafset[oneLessId].ap);
			test.equal('3.4.5.6', leafset._leafset[higherId].ap);
			test.equal('4.5.6.7', leafset._leafset[lowerId].ap);
			test.equal(1, leafset._leafset[oneMoreId].lastHeartbeatReceived);
			test.equal(2, leafset._leafset[oneLessId].lastHeartbeatReceived);
			test.equal(3, leafset._leafset[higherId].lastHeartbeatReceived);
			test.equal(4, leafset._leafset[lowerId].lastHeartbeatReceived);
			test.ok(!this.arrivedCallback.called);
			test.done();			
		}
	}),

	"updating the leafset with provisional peers" : testCase ({
		setUp : function(done) {
			node.nodeId = myId;			
			done();
		},
		
		tearDown : function(done) {
			leafset.leafsetSize = 20;
			leafset.reset();
			done();
		},
		
		"should do nothing to leafset when updating with undefined" : function(test) {			
			leafset.updateWithProvisional(undefined);
			
			test.equal(0, Object.keys(leafset._leafset).length);
			test.equal(0, Object.keys(leafset._candidateset).length);
			test.equal(0, Object.keys(leafset._deadset).length);
			test.done();
		},
		
		"should update empty leafset with provisional peer by adding to candidateset" : function(test) {
			leafset.updateWithProvisional(anId, '1.2.3.4');
			
			test.equal(0, Object.keys(leafset._leafset).length);
			test.equal(1, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[anId].ap);
			test.ok(leafset._candidateset[anId].foundAt > 0);
			test.done();
		},
		
		"should update empty leafset with provisional peer as object" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			
			leafset.updateWithProvisional(upd);
			
			test.equal(0, Object.keys(leafset._leafset).length);
			test.equal(1, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[anId].ap);
			test.ok(leafset._candidateset[anId].foundAt > 0);
			test.done();
		},
		
		"should update empty leafset with two provisional peers at once" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			upd[higherId] = '2.4.6.8';
			
			leafset.updateWithProvisional(upd);
			
			test.equal(0, Object.keys(leafset._leafset).length);
			test.equal(2, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[anId].ap);
			test.equal('2.4.6.8', leafset._candidateset[higherId].ap);
			test.ok(leafset._candidateset[anId].foundAt > 0);
			test.ok(leafset._candidateset[higherId].foundAt > 0);
			test.done();
		},
		
		"should disregard own node id when updating existing candidateset with provisional peers" : function(test) {
			leafset._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafset._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			leafset.updateWithProvisional(myId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[lowerId].ap);
			test.equal('2.3.4.5', leafset._candidateset[anId].ap);
			test.equal(1, leafset._candidateset[lowerId].foundAt);
			test.equal(2, leafset._candidateset[anId].foundAt);
			test.done();
		},
		
		"should disregard provisional peer when already in leafset" : function(test) {
			leafset._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatAt : 2};
			
			leafset.updateWithProvisional(anId, '3.4.5.6');
			
			test.equal(0, Object.keys(leafset._candidateset).length);
			test.equal(1, Object.keys(leafset._leafset).length);
			test.equal('2.3.4.5', leafset._leafset[anId].ap);
			test.equal(2, leafset._leafset[anId].lastHeartbeatAt);
			test.done();
		},
		
		"should not update existing candidate set when provisional peer already in candidateset with same ip" : function(test) {
			leafset._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafset._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			leafset.updateWithProvisional(anId, '2.3.4.5');
			
			test.equal(2, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[lowerId].ap);
			test.equal('2.3.4.5', leafset._candidateset[anId].ap);
			test.equal(1, leafset._candidateset[lowerId].foundAt);
			test.equal(2, leafset._candidateset[anId].foundAt);
			test.done();
		},
		
		"should update existing candidate set when provisional peer already in candidateset with different ip" : function(test) {
			leafset._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafset._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			leafset.updateWithProvisional(anId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[lowerId].ap);
			test.equal('3.4.5.6', leafset._candidateset[anId].ap);
			test.equal(1, leafset._candidateset[lowerId].foundAt);
			test.ok(leafset._candidateset[anId].foundAt > 2);
			test.done();
		},
		
		"should update existing candidateset with provisional peer by adding" : function(test) {
			leafset._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafset._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
				
			leafset.updateWithProvisional(higherId, '6.7.8.9');
			
			test.equal(3, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[lowerId].ap);
			test.equal('2.3.4.5', leafset._candidateset[anId].ap);
			test.equal('6.7.8.9', leafset._candidateset[higherId].ap);
			test.equal(1, leafset._candidateset[lowerId].foundAt);
			test.equal(2, leafset._candidateset[anId].foundAt);
			test.ok(leafset._candidateset[higherId].foundAt > 2);
			test.done();
		},
		
		"should update existing candidateset with three provisional peers, one new one already known but with different ip" : function(test) {
			leafset._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafset._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			var upd = {};
			upd[anId] = '3.4.5.6';
			upd[higherId] = '6.7.8.9';
			
			leafset.updateWithProvisional(upd);
			
			test.equal(3, Object.keys(leafset._candidateset).length);
			test.equal('1.2.3.4', leafset._candidateset[lowerId].ap);
			test.equal('3.4.5.6', leafset._candidateset[anId].ap);
			test.equal('6.7.8.9', leafset._candidateset[higherId].ap);
			test.equal(1, leafset._candidateset[lowerId].foundAt);
			test.ok(leafset._candidateset[anId].foundAt > 2);
			test.ok(leafset._candidateset[higherId].foundAt > 2);
			test.done();
		},
		
		"should ignore any provisional peers in the deadset" : function(test) {
			leafset._deadset[anId] = {ap : "1.2.3.4", deadAt : Date.now()};
			leafset._leafset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			
			leafset.updateWithProvisional(anId, '2.3.4.5');
			
			test.equal(0, Object.keys(leafset._candidateset).length);
			test.equal(1, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[lowerId].ap);
			test.done();
		},
		
		"should ignore any provisional peers outside leafset range where max leafset size already met" : function(test) {
			node.nodeId = anId;
			leafset.leafsetSize = 4;
			leafset._leafset[higherId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[oneLessId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafset._leafset[oneMoreId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			leafset._leafset[lowerId] = { ap : "4.5.6.7", lastHeartbeatReceived : 4};
			
			leafset.updateWithProvisional(higherId, '5.6.7.8');

			test.equal(0, Object.keys(leafset._candidateset).length);
			test.equal(4, Object.keys(leafset._leafset).length);
			test.equal('1.2.3.4', leafset._leafset[higherId].ap);
			test.equal('2.3.4.5', leafset._leafset[oneLessId].ap);
			test.equal('3.4.5.6', leafset._leafset[oneMoreId].ap);
			test.equal('4.5.6.7', leafset._leafset[lowerId].ap);
			test.done();			
		},
		
		"should add any provisional peers within leafset range to candidateset even when max leafset size already met" : function(test) {
			node.nodeId = anId;
			leafset.leafsetSize = 4;
			leafset._leafset[higherId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafset._leafset[lowerId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafset._leafset[oneMoreId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			leafset._leafset[wrappedId] = { ap : "4.5.6.7", lastHeartbeatReceived : 4};
			
			leafset.updateWithProvisional(oneLessId, '5.6.7.8');

			test.equal(1, Object.keys(leafset._candidateset).length);
			test.equal('5.6.7.8', leafset._candidateset[oneLessId].ap);
			test.equal(4, Object.keys(leafset._leafset).length);
			test.equal('4.5.6.7', leafset._leafset[wrappedId].ap);
			test.equal('3.4.5.6', leafset._leafset[oneMoreId].ap);
			test.equal('2.3.4.5', leafset._leafset[lowerId].ap);
			test.equal('1.2.3.4', leafset._leafset[higherId].ap);
			test.done();			
		}
	}),

	"getting a compressed version of the leafset" : testCase({
		tearDown : function(done) {
			leafset.reset();
			done();
		},
		
		"should get empty compressed version of empty leafset" : function(test) {
			var res = leafset.compressedLeafset();
			
			test.deepEqual({}, res);
			test.done();
		},
		
		"should get compressed version of non-empty leafset" : function(test) {
			leafset._put(anId, '1.2.3.4');
			leafset._put(higherId, '2.2.2.2');			
			
			var res = leafset.compressedLeafset();
			
			test.equal(2, Object.keys(res).length);
			test.equal('1.2.3.4', res[anId]);
			test.equal('2.2.2.2', res[higherId]);
			test.done();
		}
	}),
	
	"proximity to a given id" : testCase ({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			leafset.reset();
			done();
		},
		
		"should be able to determine that current node is nearest to given id" : function(test) {
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:1234");
			
			var res = leafset.isThisNodeNearestTo(oneLessId);
			
			test.ok(res);
			test.done();
		},
		
		"should be able to determine that current node is not nearest to given id" : function(test) {
			leafset._put(lowerId,"1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:1234");
			
			var res = leafset.isThisNodeNearestTo(wrappedId);
			
			test.ok(!res);
			test.done();
		},
		
		"should be able to determine that current node is nearest when leafset is empty" : function(test) {
			var res = leafset.isThisNodeNearestTo(wrappedId);
			
			test.ok(res);
			test.done();
		}
	}),
	
	"calculating next routing hop" : testCase ({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			node.nodeId = anId;
			leafset.reset();
			leafset.leafsetSize = 20;
			done();
		},
		
		"should return undefined as next routing hop when leafset empty" : function(test) {
			var res = leafset.getRoutingHop(anId);

			test.strictEqual(undefined, res);
			test.done();
		},
		
		"should return self as next routing hop when leafset contains higher id node" : function(test) {
			leafset._put(higherId, "1.2.3.4:1234");
			
			var res = leafset.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop when leafset contains lower id node" : function(test) {
			leafset._put(lowerId, "1.2.3.4:1234");
			
			var res = leafset.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
				
		"should return self as next routing hop whne leafset contains higher and lower id node" : function(test) {
			leafset._put(oneMoreId, "1.2.3.4:1234");
			leafset._put(oneLessId, "1.2.3.4:1234");
			
			var res = leafset.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return nearest node as next hop when within range and closer than node id" : function(test) {
			node.nodeId = '1CD0814241C2413CA7DBDD7F70C1BDE3AE98A500';			
			leafset._put('079C239AB829495CB902D46E3BB242E9F9E5960A', "1.2.3.4:1234");
			
			var res = leafset.getRoutingHop('C8D86F13CCA340D7BDE0D69548C08C4EF111F24B');
			
			test.strictEqual('079C239AB829495CB902D46E3BB242E9F9E5960A', res.id);
			test.strictEqual('1.2.3.4', res.addr);
			test.strictEqual('1234', res.port);
			test.done();
		},
		
		
		"should return nearest node as next routing hop when within leafset range" : function(test) {
			leafset._put(wrappedId, "1.2.3.4:1234");
			leafset._put(lowerId, "6.7.8.9:6789");
			leafset._put(higherId, "3.4.5.6:3456");
			
			var res = leafset.getRoutingHop(myId);
			
			test.strictEqual(wrappedId, res.id);
			test.strictEqual('1.2.3.4', res.addr);
			test.strictEqual('1234', res.port);
			test.done();
		},
		
		"should return blank next routing hop when outside leafset range" : function(test) {
			leafset.leafsetSize = 4;
			leafset._put('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', "1.2.3.4:1234");
			leafset._put('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', "1.2.3.4:5678");
			leafset._put('EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', "1.2.3.4:9012");
			leafset._put('0000000000000000000000000000000000000000', "1.2.3.4:3456");
			
			var res = leafset.getRoutingHop('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');
			
			test.strictEqual(undefined, res);
			test.done();
		}
	}),

	"checking if an id is within leafset range" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			node.nodeId = anId;
			leafset.reset();
			leafset.leafsetSize = 20;
			done();
		},
		
		"false when leafset empty" : function(test) {
			var res = leafset.isWithinLeafsetRange(anId);
			
			test.strictEqual(false, res);
			test.done();
		},
		
		"true for leafset with just one element" : function(test) {
			leafset._put(higherId, "1.2.3.4:5678");
			
			var res = leafset.isWithinLeafsetRange(wrappedId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id within range for non-wrapped, less-than-capacity leafset" : function(test) {
			leafset._put(oneLessId, "1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");
			
			var res = leafset.isWithinLeafsetRange(lowerId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id within range for wrapped, less-than-capacity leafset" : function(test) {
			leafset._put(wrappedId, "1.2.3.4:1234");
			leafset._put(lowerId, "1.2.3.4:5678");
			
			var res = leafset.isWithinLeafsetRange(myId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id within range cw where one ls side is at capacity but the other isn't" : function(test) {
			leafset.leafsetSize = 6;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			leafset._put(lowerId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(higherId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id within range ccw where one ls side is at capacity but the other isn't" : function(test) {
			leafset.leafsetSize = 6;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(higherId, "1.2.3.4");
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(lowerId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id within range cw where leafset at capacity" : function(test) {
			leafset.leafsetSize = 4;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(higherId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id within range ccw where leafset at capacity" : function(test) {
			leafset.leafsetSize = 4;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(lowerId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"false when id not within range where leafset at capacity" : function(test) {
			leafset.leafsetSize = 4;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(higherId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(wrappedId);
			
			test.strictEqual(false, res);
			test.done();
		},
		
		"true when id right on edge of leafset on cw side" : function(test) {
			leafset.leafsetSize = 2;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(oneMoreId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id right on edge of leafset on ccw side" : function(test) {
			leafset.leafsetSize = 2;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(oneLessId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"true when id same as node id" : function(test) {
			leafset.leafsetSize = 2;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(anId);
			
			test.strictEqual(true, res);
			test.done();
		},
		
		"false when id just over edge of leafset on cw side" : function(test) {
			leafset.leafsetSize = 2;
			node.nodeId = myId;
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(anId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(oneMoreId);
			
			test.strictEqual(false, res);
			test.done();
		},
		
		"false when id just over edge of leafset on ccw side" : function(test) {
			leafset.leafsetSize = 2;
			node.nodeId = higherId;
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(anId, "1.2.3.4");
			
			var res = leafset.isWithinLeafsetRange(oneLessId);
			
			test.strictEqual(false, res);
			test.done();
		}
	}),
	
	"getting edge peers for a given leafset" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			node.nodeId = anId;
			leafset.reset();
			leafset.leafsetSize = 20;
			done();
		},
		
		"just return node id when leafset empty" : function(test) {
			var res = leafset.getEdgePeers();
			
			test.deepEqual({cw : anId, ccw : anId}, res);
			test.done();
		},
		
		"for leafset with just one element, return that element" : function(test) {
			leafset._put(higherId, "1.2.3.4:5678");
			
			var res = leafset.getEdgePeers();
			
			test.deepEqual({cw : higherId, ccw : higherId}, res);
			test.done();
		},
		
		"for less-than-capacity leafset with two elements, return them both" : function(test) {
			leafset._put(oneLessId, "1.2.3.4:1234");
			leafset._put(higherId, "1.2.3.4:5678");
			
			var res = leafset.getEdgePeers();
			
			test.deepEqual({cw : oneLessId, ccw : higherId}, res);
			test.done();
		},		
		
		"when one ls side is at capacity but the other is just below, we could have the same edge node in both directions" : function(test) {
			leafset.leafsetSize = 6;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(higherId, "1.2.3.4");
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			
			var res = leafset.getEdgePeers();
			
			test.deepEqual({cw : wrappedId, ccw : wrappedId}, res);
			test.done();
		},
		
		"when leafset at capacity, return correct nodes in both directions with no wrap-around" : function(test) {
			leafset.leafsetSize = 4;
			leafset._put(oneMoreId, "1.2.3.4");
			leafset._put(wrappedId, "1.2.3.4");
			leafset._put(oneLessId, "1.2.3.4");
			leafset._put(myId, "1.2.3.4");
			
			var res = leafset.getEdgePeers();
			
			test.deepEqual({cw : wrappedId, ccw : myId}, res);
			test.done();
		}
	})
};