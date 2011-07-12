var assert = require('assert');
var sinon = require('sinon');
var routingmgr = require('overlay/routingmgr');
var node = require('core/node');
var leafset = require('overlay/leafset');
var routingtable = require('overlay/routingtable');
var testCase = require("nodeunit").testCase;

var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';
var nearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE';
var overEdgeId= '0000000000000000000000000000000000000001';

module.exports = {
	"getting the next routing hop" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			routingtable._table = {};
			leafset.reset();
			done();
		},
		
		"when we can route based on the leafset, just use that" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns({
				id : 'F7DB7ACE15254C87B81D05DA8FA49588540B1950'
			});
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.equal('F7DB7ACE15254C87B81D05DA8FA49588540B1950', res.id);
			test.done();
		},
		
		"routing via empty routing table should return self" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"routing via routing table with exact match should return that match" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.1.1.1:1111', 1);

			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');

			test.strictEqual("F7DB7ACE15254C87B81D05DA8FA49588540B1950", res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing to same id as node id should return node id as nearest" : function(test) {
			var res = routingmgr.getNextHop(anId);
		
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"routing via routing table with irrelevant entry should return self" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood(  'F78147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.1.1.1:1111', 1);
			
			var res = routingmgr.getNextHop('355607ACE1254C87B81D05DA8FA49588540B1950');
		
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"routing via routing table to id with no common prefix w/node id should return closest entry" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood(  'A78147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.1.1.1:1111', 1);

			var res = routingmgr.getNextHop('A45607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('A78147A002B4482EB6D912E3E6518F5CC80EBEE6', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table with relevant next hop entry should return that entry" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood(  'F456337A002B4482EB6D912E3E6518F5CC80EBE6', '1.1.1.1:1111', 1);

			var res = routingmgr.getNextHop('F45607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('F456337A002B4482EB6D912E3E6518F5CC80EBE6', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when closest entry is in same row of routing table" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood(  'F756337A002B4482EB6D912E3E6518F5CC80EBE6', '1.1.1.1:1111', 1);

			var res = routingmgr.getNextHop('F78607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('F756337A002B4482EB6D912E3E6518F5CC80EBE6', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when closest entry is in previous row of routing table" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood(  'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.1.1.1:1111', 1);

			var res = routingmgr.getNextHop('F08607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when no previous row in routing table" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			routingtable.updateWithKnownGood( 'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.1.1.1:1111', 1);

			var res = routingmgr.getNextHop('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD');
			
			test.equal('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when closest entry is in leafset" : function(test) {
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			leafset._put('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234');
			leafset._put('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '5.6.7.8:5678');
			routingtable.updateWithKnownGood('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234', 1);

			var res = routingmgr.getNextHop('008607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', res.id);
			test.strictEqual('5.6.7.8', res.addr);
			test.strictEqual('5678', res.port);
			test.done();
		},
		
		"routing via routing table  and leafset with multiple 'contrived' entries should route correctly" : function(test) {
			node.nodeId = '1111111111111111111111111111111111111111';
			sinon.collection.stub(leafset, 'getRoutingHop').returns(undefined);
			leafset._put('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234');
			leafset._put('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF','5.6.7.8:5678');
			routingtable.updateWithKnownGood(  'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234', 0);
			routingtable.updateWithKnownGood(  '1000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			routingtable.updateWithKnownGood(  '1100000000000000000000000000000000000000', '2.2.2.2:2222', 2);
			routingtable.updateWithKnownGood(  '1110000000000000000000000000000000000000', '3.3.3.3:3333', 3);
			routingtable.updateWithKnownGood(  '1111000000000000000000000000000000000000', '4.4.4.4:4444', 4);

			var res = routingmgr.getNextHop('1010101010101010101010101010101010101010');
			
			test.equal('1000000000000000000000000000000000000000', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		}
	})	
};