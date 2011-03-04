var assert = require('assert');
var leafsetmgr = require('core/leafsetmgr');
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
	"calculating next routing hop" : testCase ({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			leafsetmgr.reset();
			done();
		},
		
		"should return self as next routing hop when leafset empty" : function(test) {
			var res = leafsetmgr.getRoutingHop(anId)
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop when leafset contains higher id node" : function(test) {
			leafsetmgr._put(higherId, "1.2.3.4:1234");
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop when leafset contains lower id node" : function(test) {
			leafsetmgr._put(lowerId, "1.2.3.4:1234");
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop whne leafset contains higher and lower id node" : function(test) {
			leafsetmgr._put(higherId, "1.2.3.4:1234");
			leafsetmgr._put(lowerId, "1.2.3.4:1234");
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return nearest node as next routing hop when within leafset range" : function(test) {
			leafsetmgr._put(wrappedId, "1.2.3.4:1234");
			leafsetmgr._put(higherId, "6.7.8.9:6789");
			leafsetmgr._put(oneLessId, "3.4.5.6:3456");
			
			var res = leafsetmgr.getRoutingHop(lowerId);
			
			test.strictEqual(wrappedId, res.id);
			test.strictEqual('1.2.3.4', res.addr);
			test.strictEqual('1234', res.port);
			test.done();
		},
		
		"should return blank next routing hop when below leafset range" : function(test) {
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:5678");
			leafsetmgr._put(oneLessId, "1.2.3.4:9012");
			
			var res = leafsetmgr.getRoutingHop(wrappedId);
			
			test.strictEqual(undefined, res);
			test.done();
		},
		
		"should return blank next routing hop when above leafset range" : function(test) {
			leafsetmgr._put(lowerId, "1.2.3.4:1234");
			leafsetmgr._put(oneLessId, "1.2.3.4:5678");
			leafsetmgr._put(wrappedId, "1.2.3.4:9012");
			
			var res = leafsetmgr.getRoutingHop(higherId);
			
			test.strictEqual(undefined, res);
			test.done();
		}
	}),
	
	"iterating over leafset" : testCase ({
		tearDown : function(done) {
			leafsetmgr.reset();
			done();
		},
		
		"should be able to invoke given anonymous function for each leafset member" : function(test) {
			var callbacks = {};
			leafsetmgr._deadset = {};
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:5678");
			
			leafsetmgr.each(function(id, item) {
				callbacks[id] = item;
			});
			
			test.equal(2, Object.keys(callbacks).length);
			test.equal('1.2.3.4:1234', callbacks[lowerId].ap);
			test.equal('1.2.3.4:5678', callbacks[higherId].ap);
			test.done();
		},
		
		"should be able to invoke given anonymous function for each candidateset member" : function(test) {
			var callbacks = {};
			leafsetmgr._candidateset[lowerId] = {ap : "1.2.3.4:1234"};
			leafsetmgr._candidateset[higherId] = {ap : "5.6.7.8:1234"};
			
			leafsetmgr.eachCandidate(function(id, item) {
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
			leafsetmgr.reset();
			done();
		},
		
		"should be able to remove a single element from the leafset, adding it to 'deadset' and raising event" : function(test) {
			var callback = sinon.stub();
			leafsetmgr.on('peer-departed', callback);
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:5678");			
			
			leafsetmgr.removePeer(lowerId);
			
			test.strictEqual(1, Object.keys(leafsetmgr._leafset).length);
			test.ok(leafsetmgr._leafset[higherId] !== undefined);
			test.ok(leafsetmgr._leafset[higherId].deadAt === undefined);
			test.strictEqual(1, Object.keys(leafsetmgr._deadset).length);
			test.ok(leafsetmgr._deadset[lowerId].deadAt > (new Date().getTime() - 10000));
			test.ok(callback.calledWith(lowerId));
			test.done();
		},
		
		"should be able to remove all peers" : function(test) {
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:5678");
			
			leafsetmgr.reset();
			
			test.strictEqual(0, Object.keys(leafsetmgr._leafset).length);
			test.strictEqual(0, Object.keys(leafsetmgr._deadset).length);
			test.strictEqual(0, Object.keys(leafsetmgr._candidateset).length);
			test.done();
		},
		
		"should be able to remove a peer in candidate set" : function(test) {
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateWithProvisional(higherId, "1.2.3.4:5678");
			
			leafsetmgr.reset();
			
			test.strictEqual(0, Object.keys(leafsetmgr._leafset).length);
			test.strictEqual(0, Object.keys(leafsetmgr._deadset).length);
			test.strictEqual(0, Object.keys(leafsetmgr._candidateset).length);
			test.done();
		},
		
		"should be able to clear all timed out dead peers" : function(test) {
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:5678");			
			leafsetmgr.removePeer(lowerId);
			leafsetmgr.removePeer(higherId);
			leafsetmgr._deadset[lowerId].deadAt = (new Date().getTime() - 100000);
			
			leafsetmgr.clearExpiredDeadAndCandidatePeers();
			
			test.strictEqual(1, Object.keys(leafsetmgr._deadset).length);
			test.ok(leafsetmgr._deadset[lowerId] === undefined);
			test.done();
		},
		
		"should be able to clear all expired candidate peers" : function(test) {
			leafsetmgr._candidateset[lowerId] = {foundAt : new Date().getTime() - 100000};
			leafsetmgr._candidateset[higherId] = {foundAt : new Date().getTime()};
			
			leafsetmgr.clearExpiredDeadAndCandidatePeers();
			
			test.strictEqual(1, Object.keys(leafsetmgr._candidateset).length);
			test.ok(leafsetmgr._candidateset[lowerId] === undefined);
			test.done();
		}
	}), 
	
	"updating leafset with known good peers" : testCase ({
		setUp : function(done) {
			node.nodeId = myId;
			leafsetmgr.leafsetSize = 3;
			done();
		},
		
		tearDown : function(done) {
			leafsetmgr.reset();
			leafsetmgr.leafsetSize = 20;
			done();
		},
		
		"should do nothing to leafset when updating with undefined" : function(test) {			
			leafsetmgr.updateWithKnownGood(undefined);
			
			test.equal(0, Object.keys(leafsetmgr._leafset).length);
			test.equal(0, Object.keys(leafsetmgr._candidateset).length);
			test.done();
		},
		
		"should update empty leafset with known good peer by adding directly" : function(test) {
			leafsetmgr.updateWithKnownGood(anId, '1.2.3.4');
			
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[anId].ap);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 0);
			test.done();
		},
		
		"should update empty leafset with known good peer from object" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			
			leafsetmgr.updateWithKnownGood(upd);
			
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[anId].ap);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 0);
			test.done();
		},
		
		"should update empty leafset from object with two known good peers at once" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			upd[higherId] = '2.4.6.8';
			
			leafsetmgr.updateWithKnownGood(upd);
			
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[anId].ap);
			test.equal('2.4.6.8', leafsetmgr._leafset[higherId].ap);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 0);
			test.ok(leafsetmgr._leafset[higherId].lastHeartbeatReceived > 0);
			test.done();
		},
		
		"should disregaard own node id when updating existing leafset" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			leafsetmgr.updateWithKnownGood(myId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[anId].lastHeartbeatReceived);
			test.done();
		},
		
		"should update existing leafset with known good peer by replacing" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			leafsetmgr.updateWithKnownGood(anId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr._leafset[anId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 2);
			test.done();
		},
		
		"should update existing leafset with known good peer by adding" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
				
			leafsetmgr.updateWithKnownGood(higherId, '6.7.8.9');
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr._leafset[higherId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[anId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[higherId].lastHeartbeatReceived > 2);
			test.done();
		},
		
		"should update existing leafset with known good peers by replacing and adding" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			var upd = {};
			upd[anId] = '3.4.5.6';
			upd[higherId] = '6.7.8.9';
			
			leafsetmgr.updateWithKnownGood(upd);
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr._leafset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr._leafset[higherId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 2);
			test.ok(leafsetmgr._leafset[higherId].lastHeartbeatReceived > 2);
			test.done();
		},
		
		"should resurrect peer in the deadset if it is known good" : function(test) {
			leafsetmgr._deadset[anId] = {ap : "1.2.3.4", deadAt : new Date().getTime()};
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			
			leafsetmgr.updateWithKnownGood(anId, '2.3.4.5');
			
			test.equal(0, Object.keys(leafsetmgr._deadset).length);
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.done();
		},
		
		"should promote peer in the candidateset if it is known good" : function(test) {
			leafsetmgr._candidateset[anId] = {ap : "1.2.3.4"};
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			
			leafsetmgr.updateWithKnownGood(anId, '2.3.4.5');
			
			test.equal(0, Object.keys(leafsetmgr._candidateset).length);
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.done();
		},
		
		"should enforce max leafset size when adding known good peer " : function(test) {
			node.nodeId = anId;
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[oneLessId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafsetmgr._leafset[higherId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			
			var upd = {};
			upd[oneMoreId] = '4.5.6.7';
			
			leafsetmgr.updateWithKnownGood(upd);
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('3.4.5.6', leafsetmgr._leafset[higherId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[oneLessId].ap);
			test.equal('4.5.6.7', leafsetmgr._leafset[oneMoreId].ap);
			test.equal(3, leafsetmgr._leafset[higherId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[oneLessId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[oneMoreId].lastHeartbeatReceived > 2);
			test.done();			
		},
		
		"should do nothing when leafset size already max and new known good peer isn't within" : function(test) {
			node.nodeId = anId;
			leafsetmgr._leafset[higherId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[oneLessId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafsetmgr._leafset[oneMoreId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			
			var upd = {};
			upd[lowerId] = '4.5.6.7';
			
			leafsetmgr.updateWithKnownGood(upd);
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[higherId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[oneLessId].ap);
			test.equal('3.4.5.6', leafsetmgr._leafset[oneMoreId].ap);
			test.equal(1, leafsetmgr._leafset[higherId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[oneLessId].lastHeartbeatReceived);
			test.equal(3, leafsetmgr._leafset[oneMoreId].lastHeartbeatReceived);
			test.done();			
		}
	}),

	"updating the leafset with provisional peers" : testCase ({
		setUp : function(done) {
			node.nodeId = myId;
			leafsetmgr.leafsetSize = 3;
			done();
		},
		
		tearDown : function(done) {
			leafsetmgr.leafsetSize = 20;
			leafsetmgr.reset();
			done();
		},
		
		"should do nothing to leafset when updating with undefined" : function(test) {			
			leafsetmgr.updateWithProvisional(undefined);
			
			test.equal(0, Object.keys(leafsetmgr._leafset).length);
			test.equal(0, Object.keys(leafsetmgr._candidateset).length);
			test.equal(0, Object.keys(leafsetmgr._deadset).length);
			test.done();
		},
		
		"should update empty leafset with provisional peer by adding to candidateset" : function(test) {
			leafsetmgr.updateWithProvisional(anId, '1.2.3.4');
			
			test.equal(0, Object.keys(leafsetmgr._leafset).length);
			test.equal(1, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[anId].ap);
			test.ok(leafsetmgr._candidateset[anId].foundAt > 0);
			test.done();
		},
		
		"should update empty leafset with provisional peer as object" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			
			leafsetmgr.updateWithProvisional(upd);
			
			test.equal(0, Object.keys(leafsetmgr._leafset).length);
			test.equal(1, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[anId].ap);
			test.ok(leafsetmgr._candidateset[anId].foundAt > 0);
			test.done();
		},
		
		"should update empty leafset with two provisional peers at once" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			upd[higherId] = '2.4.6.8';
			
			leafsetmgr.updateWithProvisional(upd);
			
			test.equal(0, Object.keys(leafsetmgr._leafset).length);
			test.equal(2, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[anId].ap);
			test.equal('2.4.6.8', leafsetmgr._candidateset[higherId].ap);
			test.ok(leafsetmgr._candidateset[anId].foundAt > 0);
			test.ok(leafsetmgr._candidateset[higherId].foundAt > 0);
			test.done();
		},
		
		"should disregard own node id when updating existing candidateset with provisional peers" : function(test) {
			leafsetmgr._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafsetmgr._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			leafsetmgr.updateWithProvisional(myId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._candidateset[anId].ap);
			test.equal(1, leafsetmgr._candidateset[lowerId].foundAt);
			test.equal(2, leafsetmgr._candidateset[anId].foundAt);
			test.done();
		},
		
		"should disregard provisional peer when already in leafset" : function(test) {
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatAt : 2};
			
			leafsetmgr.updateWithProvisional(anId, '3.4.5.6');
			
			test.equal(0, Object.keys(leafsetmgr._candidateset).length);
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.equal(2, leafsetmgr._leafset[anId].lastHeartbeatAt);
			test.done();
		},
		
		"should not update existing candidate set when provisional peer already in candidateset with same ip" : function(test) {
			leafsetmgr._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafsetmgr._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			leafsetmgr.updateWithProvisional(anId, '2.3.4.5');
			
			test.equal(2, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._candidateset[anId].ap);
			test.equal(1, leafsetmgr._candidateset[lowerId].foundAt);
			test.equal(2, leafsetmgr._candidateset[anId].foundAt);
			test.done();
		},
		
		"should update existing candidate set when provisional peer already in candidateset with different ip" : function(test) {
			leafsetmgr._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafsetmgr._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			leafsetmgr.updateWithProvisional(anId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr._candidateset[anId].ap);
			test.equal(1, leafsetmgr._candidateset[lowerId].foundAt);
			test.ok(leafsetmgr._candidateset[anId].foundAt > 2);
			test.done();
		},
		
		"should update existing candidateset with provisional peer by adding" : function(test) {
			leafsetmgr._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafsetmgr._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
				
			leafsetmgr.updateWithProvisional(higherId, '6.7.8.9');
			
			test.equal(3, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._candidateset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr._candidateset[higherId].ap);
			test.equal(1, leafsetmgr._candidateset[lowerId].foundAt);
			test.equal(2, leafsetmgr._candidateset[anId].foundAt);
			test.ok(leafsetmgr._candidateset[higherId].foundAt > 2);
			test.done();
		},
		
		"should update existing candidateset with three provisional peers, one new one already known but with different ip" : function(test) {
			leafsetmgr._candidateset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			leafsetmgr._candidateset[anId] = { ap : "2.3.4.5", foundAt : 2};
			
			var upd = {};
			upd[anId] = '3.4.5.6';
			upd[higherId] = '6.7.8.9';
			
			leafsetmgr.updateWithProvisional(upd);
			
			test.equal(3, Object.keys(leafsetmgr._candidateset).length);
			test.equal('1.2.3.4', leafsetmgr._candidateset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr._candidateset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr._candidateset[higherId].ap);
			test.equal(1, leafsetmgr._candidateset[lowerId].foundAt);
			test.ok(leafsetmgr._candidateset[anId].foundAt > 2);
			test.ok(leafsetmgr._candidateset[higherId].foundAt > 2);
			test.done();
		},
		
		"should ignore any provisional peers in the deadset" : function(test) {
			leafsetmgr._deadset[anId] = {ap : "1.2.3.4", deadAt : new Date().getTime()};
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", foundAt : 1};
			
			leafsetmgr.updateWithProvisional(anId, '2.3.4.5');
			
			test.equal(0, Object.keys(leafsetmgr._candidateset).length);
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.done();
		},
		
		"should ignore any provisional peers outside leafset range where max leafset size already met" : function(test) {
			node.nodeId = anId;
			leafsetmgr._leafset[higherId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[oneLessId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafsetmgr._leafset[oneMoreId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			
			var upd = {};
			upd[lowerId] = '4.5.6.7';
			
			leafsetmgr.updateWithProvisional(upd);

			test.equal(0, Object.keys(leafsetmgr._candidateset).length);
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('3.4.5.6', leafsetmgr._leafset[oneMoreId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[oneLessId].ap);
			test.equal('1.2.3.4', leafsetmgr._leafset[higherId].ap);
			test.done();			
		},
		
		"should add any provisional peers within leafset range to candidateset even when max leafset size already met" : function(test) {
			node.nodeId = anId;
			leafsetmgr._leafset[higherId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[lowerId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafsetmgr._leafset[oneMoreId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			
			var upd = {};
			upd[oneLessId] = '4.5.6.7';
			
			leafsetmgr.updateWithProvisional(upd);

			test.equal(1, Object.keys(leafsetmgr._candidateset).length);
			test.equal('4.5.6.7', leafsetmgr._candidateset[oneLessId].ap);
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('3.4.5.6', leafsetmgr._leafset[oneMoreId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[lowerId].ap);
			test.equal('1.2.3.4', leafsetmgr._leafset[higherId].ap);
			test.done();			
		}
	}),
	
	"getting a compressed version of the leafset" : testCase({
		tearDown : function(done) {
			leafsetmgr.reset();
			done();
		},
		
		"should get empty compressed version of empty leafset" : function(test) {
			var res = leafsetmgr.compressedLeafset();
			
			test.deepEqual({}, res);
			test.done();
		},
		
		"should get compressed version of non-empty leafset" : function(test) {
			leafsetmgr._put(anId, '1.2.3.4');
			leafsetmgr._put(higherId, '2.2.2.2');			
			
			var res = leafsetmgr.compressedLeafset();
			
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
			leafsetmgr.reset();
			done();
		},
		
		"should be able to determine that current node is nearest to given id" : function(test) {
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:1234");
			
			var res = leafsetmgr.isThisNodeNearestTo(oneLessId);
			
			test.ok(res);
			test.done();
		},
		
		"should be able to determine that current node not is nearest to given id" : function(test) {
			leafsetmgr._put(lowerId,"1.2.3.4:1234");
			leafsetmgr._put(higherId, "1.2.3.4:1234");
			
			var res = leafsetmgr.isThisNodeNearestTo(wrappedId);
			
			test.ok(!res);
			test.done();
		},
		
		"should be able to determine that current node is nearest when leafset is empty" : function(test) {
			var res = leafsetmgr.isThisNodeNearestTo(wrappedId);
			
			test.ok(res);
			test.done();
		}
	})
};