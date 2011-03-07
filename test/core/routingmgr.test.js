var assert = require('assert');
var sinon = require('sinon');
var routingmgr = require('core/routingmgr');
var node = require('core/node');
var leafsetmgr = require('core/leafsetmgr');
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
	"updating the routing table" : testCase({
		setUp : function(done) {
			routingmgr.routingTable = {};
			node.nodeId = anId;
			done();
		},
		
		"update routing table with nothing" : function(test) {
			routingmgr.updateRoutingTable(undefined);
			
			test.equal(0, Object.keys(routingmgr.routingTable).length);
			test.done();
		},

		"update empty routing table with an id with no bits in common" : function(test) {
			routingmgr.updateRoutingTable('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'1.2.3.4:1234'}}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"update empty routing table with an id with 1 bit in common" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234');
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'}}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"update empty routing table with the id equal to the node id" : function(test) {
			routingmgr.updateRoutingTable(anId, '1.2.3.4:1234');
			
			test.deepEqual({}, routingmgr.routingTable);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a different prefix" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234');
			
			routingmgr.updateRoutingTable('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678');
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'5.6.7.8:5678'}},
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'}}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a common prefix" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234');
			
			routingmgr.updateRoutingTable('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678');
			
			test.deepEqual({
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"routing table having a single entry does not get altered by a new entry with the same prefix" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234');
			
			routingmgr.updateRoutingTable('F78147A002B4482EB6D912E3E6518F5CC80EBEE6','5.6.7.8:5678');
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'}}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"should be able to update routing table by passing multiple nodes at once" : function(test) {
			routingmgr.updateRoutingTable({
				'F7DB7ACE15254C87B81D05DA8FA49588540B1950' : '1.2.3.4:1234',
				'F8D147A002B4482EB6D912E3E6518F5CC80EBEE6' : '5.6.7.8:5678'
			});
			
			test.deepEqual({
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			}, routingmgr.routingTable);
			test.done();
		}
	}),

	"merging another routing table into our one" : testCase({
		setUp : function(done) {
			routingmgr.routingTable = {};
			node.nodeId = anId;
			done();
		},
		
		"should merge empty routing table into empty" : function(test) {
			routingmgr.mergeRoutingTable({});
			
			test.deepEqual({}, routingmgr.routingTable);
			test.done();
		},
		
		"should merge non-empty routing table into empty" : function(test) {
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			routingmgr.mergeRoutingTable(rt);
			
			test.deepEqual(rt, routingmgr.routingTable);
			test.done();
		},
		
		"should merge non-empty routing table into non-empty, without replacing existing entries" : function(test) {
			routingmgr.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingmgr.updateRoutingTable('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			routingmgr.mergeRoutingTable(rt);
			
			test.deepEqual({
				"0":{
					"C":{id:'C695A1A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'3.4.5.6:3456'}
				},
				"1":{
					"7":{id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			}, routingmgr.routingTable);
			test.done();
		}
	}),
	
	"iterating over peers in the routing table" : testCase({
		setUp : function(done) {
			routingmgr.routingTable = {};
			node.nodeId = anId;
			var _this = this;
			this.callback = sinon.stub();
			done();
		},
		
		"should do nothing when iterating over empty routing table" : function(test) {
			routingmgr.each(this.callback);
			
			test.ok(!this.callback.called);
			test.done();
		},
		
		"should iterate over a two-peer table with same common prefix" : function(test) {
			routingmgr.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingmgr.updateRoutingTable('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			
			routingmgr.each(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.deepEqual(this.callback.args[0][0], {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'});
			test.equal(this.callback.args[0][1], '1');
			test.equal(this.callback.args[0][2], '7');
			test.deepEqual(this.callback.args[1][0], {id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456'});
			test.equal(this.callback.args[1][1], '1');
			test.equal(this.callback.args[1][2], '8');
			test.done();
		},
		
		"should iterate over a two-peer table with different common prefixes" : function(test) {
			routingmgr.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingmgr.updateRoutingTable('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			
			routingmgr.each(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.deepEqual(this.callback.args[0][0], {id:"C695A1A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456'});
			test.equal(this.callback.args[0][1], '0');
			test.equal(this.callback.args[0][2], 'C');
			test.deepEqual(this.callback.args[1][0], {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'});
			test.equal(this.callback.args[1][1], '1');
			test.equal(this.callback.args[1][2], '7');
			test.done();
		}
	}),
	
	"getting the next routing hop" : testCase({
		setUp : function(done) {
			routingmgr.routingTable = {};
			leafsetmgr.reset();
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"when we can route based on the leafset, just use that" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns({
				id : 'F7DB7ACE15254C87B81D05DA8FA49588540B1950'
			});
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.equal('F7DB7ACE15254C87B81D05DA8FA49588540B1950', res.id);
			test.done();
		},
		
		"routing via empty routing table should return self" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"routing via routing table with exact match should return that match" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.1.1.1:1111');

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
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable(  'F78147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.1.1.1:1111');
			
			var res = routingmgr.getNextHop('355607ACE1254C87B81D05DA8FA49588540B1950');
		
			test.strictEqual(anId, res.id);
			test.strictEqual(undefined, res.addr);
			test.strictEqual(undefined, res.port);
			test.done();
		},
		
		"routing via routing table to id with no common prefix w/node id should return closest entry" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable(  'A78147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.1.1.1:1111');

			var res = routingmgr.getNextHop('A45607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('A78147A002B4482EB6D912E3E6518F5CC80EBEE6', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table with relevant next hop entry should return that entry" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable(  'F456337A002B4482EB6D912E3E6518F5CC80EBE6', '1.1.1.1:1111');

			var res = routingmgr.getNextHop('F45607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('F456337A002B4482EB6D912E3E6518F5CC80EBE6', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when closest entry is in same row of routing table" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable(  'F756337A002B4482EB6D912E3E6518F5CC80EBE6', '1.1.1.1:1111');

			var res = routingmgr.getNextHop('F78607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('F756337A002B4482EB6D912E3E6518F5CC80EBE6', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when closest entry is in previous row of routing table" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable(  'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.1.1.1:1111');

			var res = routingmgr.getNextHop('F08607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when no previous row in routing table" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			routingmgr.updateRoutingTable(  'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.1.1.1:1111');

			var res = routingmgr.getNextHop('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD');
			
			test.equal('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		},
		
		"routing via routing table w/o relevant next hop entry returns closest entry from [leafset, routingtable] when closest entry is in leafset" : function(test) {
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			leafsetmgr._put('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234');
			leafsetmgr._put('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '5.6.7.8:5678');
			routingmgr.updateRoutingTable(  'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234');

			var res = routingmgr.getNextHop('008607ACE1254C87B81D05DA8FA49588540B1950');
			
			test.equal('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', res.id);
			test.strictEqual('5.6.7.8', res.addr);
			test.strictEqual('5678', res.port);
			test.done();
		},
		
		"routing via routing table  and leafset with multiple 'contrived' entries should route correctly" : function(test) {
			node.nodeId = '1111111111111111111111111111111111111111';
			sinon.collection.stub(leafsetmgr, 'getRoutingHop').returns(undefined);
			leafsetmgr._put('EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234');
			leafsetmgr._put('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF','5.6.7.8:5678');
			routingmgr.updateRoutingTable(  'EFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', '1.2.3.4:1234');
			routingmgr.updateRoutingTable(  '1000000000000000000000000000000000000000', '1.1.1.1:1111');
			routingmgr.updateRoutingTable(  '1100000000000000000000000000000000000000', '2.2.2.2:2222');
			routingmgr.updateRoutingTable(  '1110000000000000000000000000000000000000', '3.3.3.3:3333');
			routingmgr.updateRoutingTable(  '1111000000000000000000000000000000000000', '4.4.4.4:4444');

			var res = routingmgr.getNextHop('1010101010101010101010101010101010101010');
			
			test.equal('1000000000000000000000000000000000000000', res.id);
			test.strictEqual('1.1.1.1', res.addr);
			test.strictEqual('1111', res.port);
			test.done();
		}
	})
};