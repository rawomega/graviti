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
			leafsetmgr.leafset = {};		
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
			leafsetmgr.leafset[higherId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop when leafset contains lower id node" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return self as next routing hop whne leafset contains higher and lower id node" : function(test) {
			leafsetmgr.leafset[higherId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			
			var res = leafsetmgr.getRoutingHop(anId);
			
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"should return nearest node as next routing hop when within leafset range" : function(test) {
			leafsetmgr.leafset[wrappedId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[higherId] = { ap : "6.7.8.9:6789", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[oneLessId] = { ap : "3.4.5.6:3456", lastHeartbeat : 123456789 };
			
			var res = leafsetmgr.getRoutingHop(lowerId);
			
			test.strictEqual(wrappedId, res.id);
			test.strictEqual('1.2.3.4', res.addr);
			test.strictEqual('1234', res.port);
			test.done();
		},
		
		"should return blank next routing hop when below leafset range" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[higherId] = { ap : "1.2.3.4:5678", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[oneLessId] = { ap : "1.2.3.4:9012", lastHeartbeat : 123456789 };
			
			var res = leafsetmgr.getRoutingHop(wrappedId);
			
			test.strictEqual(undefined, res);
			test.done();
		},
		
		"should return blank next routing hop when above leafset range" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4:1234", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[oneLessId] = { ap : "1.2.3.4:5678", lastHeartbeat : 123456789 };
			leafsetmgr.leafset[wrappedId] = { ap : "1.2.3.4:9012", lastHeartbeat : 123456789 };
			
			var res = leafsetmgr.getRoutingHop(higherId);
			
			test.strictEqual(undefined, res);
			test.done();
		}
	}),
	
	"updating the leafset" : testCase ({
		setUp : function(done) {
			node.nodeId = myId;
			leafsetmgr.leafset = {};
			leafsetmgr.leafsetSize = 3;
			done();
		},
		
		"should do nothing to leafset when updating with undefined" : function(test) {			
			leafsetmgr.updateLeafset(undefined);
			
			test.equal(0, Object.keys(leafsetmgr.leafset).length);
			test.done();
		},
		
		"should update empty leafset from string" : function(test) {
			leafsetmgr.updateLeafset(anId, '1.2.3.4');
			
			test.equal(1, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[anId].ap);
			test.ok(leafsetmgr.leafset[anId].lastHeartbeat > 0);
			test.done();
		},
		
		"should update empty leafset from object" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(1, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[anId].ap);
			test.ok(leafsetmgr.leafset[anId].lastHeartbeat > 0);
			test.done();
		},
		
		"should update empty leafset from object with two nodes at once" : function(test) {
			var upd = {};
			upd[anId] = '1.2.3.4';
			upd[higherId] = '2.4.6.8';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(2, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[anId].ap);
			test.equal('2.4.6.8', leafsetmgr.leafset[higherId].ap);
			test.ok(leafsetmgr.leafset[anId].lastHeartbeat > 0);
			test.ok(leafsetmgr.leafset[higherId].lastHeartbeat > 0);
			test.done();
		},
		
		"should disregaard own node id when updating existing leafset" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeat : 1};
			leafsetmgr.leafset[anId] = { ap : "2.3.4.5", lastHeartbeat : 2};
			
			leafsetmgr.updateLeafset(myId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr.leafset[anId].ap);
			test.equal(1, leafsetmgr.leafset[lowerId].lastHeartbeat);
			test.equal(2, leafsetmgr.leafset[anId].lastHeartbeat);
			test.done();
		},
		
		"should update existing leafset from strings by replacing" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeat : 1};
			leafsetmgr.leafset[anId] = { ap : "2.3.4.5", lastHeartbeat : 2};
			
			leafsetmgr.updateLeafset(anId, '3.4.5.6');
			
			test.equal(2, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr.leafset[anId].ap);
			test.equal(1, leafsetmgr.leafset[lowerId].lastHeartbeat);
			test.ok(leafsetmgr.leafset[anId].lastHeartbeat > 2);
			test.done();
		},
		
		"should update existing leafset from strings by adding" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeat : 1};
			leafsetmgr.leafset[anId] = { ap : "2.3.4.5", lastHeartbeat : 2};
				
			leafsetmgr.updateLeafset(higherId, '6.7.8.9');
			
			test.equal(3, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[lowerId].ap);
			test.equal('2.3.4.5', leafsetmgr.leafset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr.leafset[higherId].ap);
			test.equal(1, leafsetmgr.leafset[lowerId].lastHeartbeat);
			test.equal(2, leafsetmgr.leafset[anId].lastHeartbeat);
			test.ok(leafsetmgr.leafset[higherId].lastHeartbeat > 2);
			test.done();
		},
		
		"should update existing leafset from object by replacing and adding" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeat : 1};
			leafsetmgr.leafset[anId] = { ap : "2.3.4.5", lastHeartbeat : 2};
			
			var upd = {};
			upd[anId] = '3.4.5.6';
			upd[higherId] = '6.7.8.9';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(3, Object.keys(leafsetmgr.leafset).length);
			test.equal('1.2.3.4', leafsetmgr.leafset[lowerId].ap);
			test.equal('3.4.5.6', leafsetmgr.leafset[anId].ap);
			test.equal('6.7.8.9', leafsetmgr.leafset[higherId].ap);
			test.equal(1, leafsetmgr.leafset[lowerId].lastHeartbeat);
			test.ok(leafsetmgr.leafset[anId].lastHeartbeat > 2);
			test.ok(leafsetmgr.leafset[higherId].lastHeartbeat > 2);
			test.done();
		},
		
		"should enforce max leafset size" : function(test) {
			leafsetmgr.leafset[lowerId] = { ap : "1.2.3.4", lastHeartbeat : 1};
			leafsetmgr.leafset[anId] = { ap : "2.3.4.5", lastHeartbeat : 2};
			leafsetmgr.leafset[higherId] = { ap : "3.4.5.6", lastHeartbeat : 3};
			
			var upd = {};
			upd[oneMoreId] = '4.5.6.7';
			
			leafsetmgr.updateLeafset(upd);
			
			test.equal(3, Object.keys(leafsetmgr.leafset).length);
			test.equal('3.4.5.6', leafsetmgr.leafset[higherId].ap);
			test.equal('2.3.4.5', leafsetmgr.leafset[anId].ap);
			test.equal('4.5.6.7', leafsetmgr.leafset[oneMoreId].ap);
			test.equal(3, leafsetmgr.leafset[higherId].lastHeartbeat);
			test.equal(2, leafsetmgr.leafset[anId].lastHeartbeat);
			test.ok(leafsetmgr.leafset[oneMoreId].lastHeartbeat > 2);
			test.done();			
		}
	}),
	
	"getting a compressed version of the leafset" : testCase({
		"should get empty compressed version of empty leafset" : function(test) {
			leafsetmgr.leafset = {};
			
			var res = leafsetmgr.compressedLeafset();
			
			test.deepEqual({}, res);
			test.done();
		},
		
		"should get compressed version of non-empty leafset" : function(test) {
			leafsetmgr.leafset = {};
			leafsetmgr.updateLeafset(anId, '1.2.3.4');
			leafsetmgr.updateLeafset(higherId, '2.2.2.2');			
			
			var res = leafsetmgr.compressedLeafset();
			
			test.equal(2, Object.keys(res).length);
			test.equal('1.2.3.4', res[anId]);
			test.equal('2.2.2.2', res[higherId]);
			test.done();
		}
	})	
};