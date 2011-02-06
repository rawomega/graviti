var gently = global.GENTLY = new (require('gently'));
var leafsetmgr = require('leafsetmgr');
var assert = require('assert');

var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';

gently.hijacked['node'].nodeId = anId;	

module.exports = {
	shouldReturnSelfAsNextRoutingHopWhenLeafsetEmpty : function() {
		leafsetmgr.leafset = {};
		
		assert.strictEqual(anId, leafsetmgr.getRoutingHop(anId));
	},
	
	shouldReturnSelfAsNextRoutingHopWhenLeafsetContainsHigherIdNode : function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[higherId] = "1.2.3.4";
		
		assert.strictEqual(anId, leafsetmgr.getRoutingHop(anId));
	},
	
	shouldReturnSelfAsNextRoutingHopWhenLeafsetContainsLowerIdNode : function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		
		assert.strictEqual(anId, leafsetmgr.getRoutingHop(anId));
	},
	
	shouldReturnSelfAsNextRoutingHopWhenLeafsetContainsHigherAndLowerIdNode : function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[higherId] = "1.2.3.4";
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		
		assert.strictEqual(anId, leafsetmgr.getRoutingHop(anId));
	},
	
	shouldReturnNearestNodeAsNextRoutingHopWhenWithinLeafsetRange: function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[wrappedId] = "1.2.3.4";
		leafsetmgr.leafset[higherId] = "1.2.3.4";
		leafsetmgr.leafset[oneLessId] = "1.2.3.4";
		
		assert.strictEqual(wrappedId, leafsetmgr.getRoutingHop(lowerId));
	},
	
	shouldReturnBlankNextRoutingHopWhenBelowLeafsetRange: function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		leafsetmgr.leafset[higherId] = "1.2.3.4";
		leafsetmgr.leafset[oneLessId] = "1.2.3.4";
		
		assert.strictEqual(undefined, leafsetmgr.getRoutingHop(wrappedId));
	},
	
	shouldReturnBlankNextRoutingHopWhenAboveLeafsetRange: function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		leafsetmgr.leafset[oneLessId] = "1.2.3.4";
		leafsetmgr.leafset[wrappedId] = "1.2.3.4";
		
		assert.strictEqual(undefined, leafsetmgr.getRoutingHop(higherId));
	},
	
	shouldDoNothingToLeafsetWhenUpdatingWithUndefined : function() {
		leafsetmgr.leafset = {};		
		
		leafsetmgr.updateLeafset(undefined);
		
		assert.eql(0, Object.keys(leafsetmgr.leafset).length);
	},
	
	shouldUpdateEmptyLeafsetFromString : function() {
		leafsetmgr.leafset = {};		
		
		leafsetmgr.updateLeafset(anId, '1.2.3.4');
		
		assert.eql(1, Object.keys(leafsetmgr.leafset).length);
		assert.eql('1.2.3.4', leafsetmgr.leafset[anId]);
	},
	
	shouldUpdateEmptyLeafsetFromObject : function() {
		leafsetmgr.leafset = {};		
		var upd = {};
		upd[anId] = '1.2.3.4';
		
		leafsetmgr.updateLeafset(upd);
		
		assert.eql(1, Object.keys(leafsetmgr.leafset).length);
		assert.eql('1.2.3.4', leafsetmgr.leafset[anId]);
	},
	
	shouldUpdateEmptyLeafsetFromObjectWithTwoNodesAtOnce : function() {
		leafsetmgr.leafset = {};		
		var upd = {};
		upd[anId] = '1.2.3.4';
		upd[higherId] = '2.4.6.8';
		
		leafsetmgr.updateLeafset(upd);
		
		assert.eql(2, Object.keys(leafsetmgr.leafset).length);
		assert.eql('1.2.3.4', leafsetmgr.leafset[anId]);
		assert.eql('2.4.6.8', leafsetmgr.leafset[higherId]);
	},
	
	shouldUpdateExistingLeafsetFromStringsByReplacing : function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		leafsetmgr.leafset[anId] = "2.3.4.5";
		
		leafsetmgr.updateLeafset(anId, '3.4.5.6');
		
		assert.eql(2, Object.keys(leafsetmgr.leafset).length);
		assert.eql('1.2.3.4', leafsetmgr.leafset[lowerId]);
		assert.eql('3.4.5.6', leafsetmgr.leafset[anId]);
	},
	
	shouldUpdateExistingLeafsetFromStringsByAdding : function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		leafsetmgr.leafset[anId] = "2.3.4.5";
			
		leafsetmgr.updateLeafset(higherId, '6.7.8.9');
		
		assert.eql(3, Object.keys(leafsetmgr.leafset).length);
		assert.eql('1.2.3.4', leafsetmgr.leafset[lowerId]);
		assert.eql('2.3.4.5', leafsetmgr.leafset[anId]);
		assert.eql('6.7.8.9', leafsetmgr.leafset[higherId]);
	},
	
	shouldUpdateExistingLeafsetFromObjectByReplacingAndAdding : function() {
		leafsetmgr.leafset = {};
		leafsetmgr.leafset[lowerId] = "1.2.3.4";
		leafsetmgr.leafset[anId] = "2.3.4.5";
		var upd = {};
		upd[anId] = '3.4.5.6';
		upd[higherId] = '6.7.8.9';
		
		leafsetmgr.updateLeafset(upd);
		
		assert.eql(3, Object.keys(leafsetmgr.leafset).length);
		assert.eql('1.2.3.4', leafsetmgr.leafset[lowerId]);
		assert.eql('3.4.5.6', leafsetmgr.leafset[anId]);
		assert.eql('6.7.8.9', leafsetmgr.leafset[higherId]);
	},
};