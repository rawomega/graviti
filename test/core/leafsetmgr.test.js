var assert = require('assert');
var leafsetmgr = require('core/leafsetmgr');
var node = require('core/node');
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
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:1234");
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop when leafset contains lower id node" : function(test) {
			leafsetmgr.updateLeafset(lowerId, "1.2.3.4:1234");
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop whne leafset contains higher and lower id node" : function(test) {
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:1234");
			leafsetmgr.updateLeafset(lowerId, "1.2.3.4:1234");
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return nearest node as next routing hop when within leafset range" : function(test) {
			leafsetmgr.updateLeafset(wrappedId, "1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "6.7.8.9:6789");
			leafsetmgr.updateLeafset(oneLessId, "3.4.5.6:3456");
			
			var res = leafsetmgr.getRoutingHop(lowerId);
			
			test.strictEqual(wrappedId, res.id);
			test.strictEqual('1.2.3.4', res.addr);
			test.strictEqual('1234', res.port);
			test.done();
		},
		
		"should return blank next routing hop when below leafset range" : function(test) {
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:5678");
			leafsetmgr.updateLeafset(oneLessId, "1.2.3.4:9012");
			
			var res = leafsetmgr.getRoutingHop(wrappedId);
			
			test.strictEqual(undefined, res);
			test.done();
		},
		
		"should return blank next routing hop when above leafset range" : function(test) {
			leafsetmgr.updateLeafset(lowerId, "1.2.3.4:1234");
			leafsetmgr.updateLeafset(oneLessId, "1.2.3.4:5678");
			leafsetmgr.updateLeafset(wrappedId, "1.2.3.4:9012");
			
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
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:5678");
			
			leafsetmgr.each(function(id, item) {
				callbacks[id] = item;
			});
			
			test.equal(2, Object.keys(callbacks).length);
			test.equal('1.2.3.4:1234', callbacks[lowerId].ap);
			test.equal('1.2.3.4:5678', callbacks[higherId].ap);
			test.done();
		}
	}),
	
	"removing elements from the leafset" : testCase ({
		tearDown : function(done) {
			leafsetmgr.reset();
			done();
		},
		
		"should be able to remove a single element from the leafset, adding it to 'deadset'" : function(test) {
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:5678");
			
			leafsetmgr.remove(lowerId);
			
			test.strictEqual(1, Object.keys(leafsetmgr._leafset).length);
			test.ok(leafsetmgr._leafset[higherId] !== undefined);
			test.ok(leafsetmgr._leafset[higherId].deadAt === undefined);
			test.strictEqual(1, Object.keys(leafsetmgr._deadset).length);
			test.ok(leafsetmgr._deadset[lowerId].deadAt > (new Date().getTime() - 10000));
			test.done();
		},
		
		"should be able to remove all peers from the leafset and deadset" : function(test) {
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:5678");
			
			leafsetmgr.reset();
			
			test.strictEqual(0, Object.keys(leafsetmgr._leafset).length);
			test.strictEqual(0, Object.keys(leafsetmgr._deadset).length);
			test.done();
		},
		
		"should be able to clear all timed out dead peers" : function(test) {
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:5678");			
			leafsetmgr.remove(lowerId);
			leafsetmgr.remove(higherId);
			leafsetmgr._deadset[lowerId].deadAt = (new Date().getTime() - 100000);
			
			leafsetmgr.clearExpiredDeadPeers();
			
			test.strictEqual(1, Object.keys(leafsetmgr._deadset).length);
			test.ok(leafsetmgr._deadset[lowerId] === undefined);
			test.done();
		}
	}), 
	
	"updating the leafset" : testCase ({
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
			leafsetmgr.updateLeafset(undefined);
			
			test.equal(0, Object.keys(leafsetmgr._leafset).length);
			test.done();
		},
		
		"should update empty leafset from string" : function(test) {
			leafsetmgr.updateLeafset(anId, '1.2.3.4');
			
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[anId].ap);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 0);
			test.done();
		},
		
		"should update empty leafset from object" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[anId].ap);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 0);
			test.done();
		},
		
		"should update empty leafset from object with two nodes at once" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			upd[higherId] = '2.4.6.8';
			
			leafsetmgr.updateLeafset(upd);
			
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
			
			leafsetmgr.updateLeafset(myId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[anId].lastHeartbeatReceived);
			test.done();
		},
		
		"should update existing leafset from strings by replacing" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			leafsetmgr.updateLeafset(anId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr._leafset[anId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 2);
			test.done();
		},
		
		"should update existing leafset from strings by adding" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
				
			leafsetmgr.updateLeafset(higherId, '6.7.8.9');
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr._leafset[higherId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[anId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[higherId].lastHeartbeatReceived > 2);
			test.done();
		},
		
		"should update existing leafset from object by replacing and adding" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			
			var upd = {};
			upd[anId] = '3.4.5.6';
			upd[higherId] = '6.7.8.9';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr._leafset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr._leafset[higherId].ap);
			test.equal(1, leafsetmgr._leafset[lowerId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[anId].lastHeartbeatReceived > 2);
			test.ok(leafsetmgr._leafset[higherId].lastHeartbeatReceived > 2);
			test.done();
		},
		
		"should ignore any peers in the deadset" : function(test) {
			leafsetmgr._deadset[anId] = {ap : "1.2.3.4", deadAt : new Date().getTime()};
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			
			leafsetmgr.updateLeafset(anId, '2.3.4.5');
			
			test.equal(1, Object.keys(leafsetmgr._leafset).length);
			test.equal('1.2.3.4', leafsetmgr._leafset[lowerId].ap);
			test.done();
		},
		
		"should enforce max leafset size" : function(test) {
			leafsetmgr._leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeatReceived : 1};
			leafsetmgr._leafset[anId] = { ap : "2.3.4.5", lastHeartbeatReceived : 2};
			leafsetmgr._leafset[higherId] = { ap : "3.4.5.6", lastHeartbeatReceived : 3};
			
			var upd = {};
			upd[oneMoreId] = '4.5.6.7';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(3, Object.keys(leafsetmgr._leafset).length);
			test.equal('3.4.5.6', leafsetmgr._leafset[higherId].ap);
			test.equal('2.3.4.5', leafsetmgr._leafset[anId].ap);
			test.equal('4.5.6.7', leafsetmgr._leafset[oneMoreId].ap);
			test.equal(3, leafsetmgr._leafset[higherId].lastHeartbeatReceived);
			test.equal(2, leafsetmgr._leafset[anId].lastHeartbeatReceived);
			test.ok(leafsetmgr._leafset[oneMoreId].lastHeartbeatReceived > 2);
			test.done();			
		}
	}),
	
	"getting a compressed version of the leafset" : testCase({
		"should get empty compressed version of empty leafset" : function(test) {
			leafsetmgr._leafset = {};
			
			var res = leafsetmgr.compressedLeafset();
			
			test.deepEqual({}, res);
			test.done();
		},
		
		"should get compressed version of non-empty leafset" : function(test) {
			leafsetmgr._leafset = {};
			leafsetmgr.updateLeafset(anId, '1.2.3.4');
			leafsetmgr.updateLeafset(higherId, '2.2.2.2');			
			
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
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:1234");
			
			var res = leafsetmgr.isThisNodeNearestTo(oneLessId);
			
			test.ok(res);
			test.done();
		},
		
		"should be able to determine that current node not is nearest to given id" : function(test) {
			leafsetmgr.updateLeafset(lowerId,"1.2.3.4:1234");
			leafsetmgr.updateLeafset(higherId, "1.2.3.4:1234");
			
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