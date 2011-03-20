var assert = require('assert');
var sinon = require('sinon');
var routingtable = require('core/routingtable');
var node = require('core/node');
var leafset = require('core/leafset');
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
			routingtable.routingTable = {};
			node.nodeId = anId;
			done();
		},
		
		"update routing table with nothing" : function(test) {
			routingtable.updateRoutingTable(undefined);
			
			test.equal(0, Object.keys(routingtable.routingTable).length);
			test.done();
		},

		"update empty routing table with an id with no bits in common" : function(test) {
			routingtable.updateRoutingTable('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'1.2.3.4:1234'}}
			}, routingtable.routingTable);
			test.done();
		},
		
		"update empty routing table with an id with 1 bit in common" : function(test) {
			routingtable.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234');
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'}}
			}, routingtable.routingTable);
			test.done();
		},
		
		"update empty routing table with the id equal to the node id" : function(test) {
			routingtable.updateRoutingTable(anId, '1.2.3.4:1234');
			
			test.deepEqual({}, routingtable.routingTable);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a different prefix" : function(test) {
			routingtable.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234');
			
			routingtable.updateRoutingTable('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678');
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'5.6.7.8:5678'}},
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'}}
			}, routingtable.routingTable);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a common prefix" : function(test) {
			routingtable.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234');
			
			routingtable.updateRoutingTable('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678');
			
			test.deepEqual({
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			}, routingtable.routingTable);
			test.done();
		},
		
		"routing table having a single entry does not get altered by a new entry with the same prefix" : function(test) {
			routingtable.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234');
			
			routingtable.updateRoutingTable('F78147A002B4482EB6D912E3E6518F5CC80EBEE6','5.6.7.8:5678');
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'}}
			}, routingtable.routingTable);
			test.done();
		},
		
		"should be able to update routing table by passing multiple nodes at once" : function(test) {
			routingtable.updateRoutingTable({
				'F7DB7ACE15254C87B81D05DA8FA49588540B1950' : '1.2.3.4:1234',
				'F8D147A002B4482EB6D912E3E6518F5CC80EBEE6' : '5.6.7.8:5678'
			});
			
			test.deepEqual({
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			}, routingtable.routingTable);
			test.done();
		}
	}),

	"merging another routing table into our one" : testCase({
		setUp : function(done) {
			routingtable.routingTable = {};
			node.nodeId = anId;
			done();
		},
		
		"should merge empty routing table into empty" : function(test) {
			routingtable.mergeRoutingTable({});
			
			test.deepEqual({}, routingtable.routingTable);
			test.done();
		},
		
		"should merge non-empty routing table into empty" : function(test) {
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			routingtable.mergeRoutingTable(rt);
			
			test.deepEqual(rt, routingtable.routingTable);
			test.done();
		},
		
		"should merge non-empty routing table into non-empty, without replacing existing entries" : function(test) {
			routingtable.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingtable.updateRoutingTable('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			routingtable.mergeRoutingTable(rt);
			
			test.deepEqual({
				"0":{
					"C":{id:'C695A1A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'3.4.5.6:3456'}
				},
				"1":{
					"7":{id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			}, routingtable.routingTable);
			test.done();
		}
	}),
	
	"iterating over peers in the routing table" : testCase({
		setUp : function(done) {
			routingtable.routingTable = {};
			node.nodeId = anId;
			var _this = this;
			this.callback = sinon.stub();
			done();
		},
		
		"should do nothing when iterating over peers empty routing table" : function(test) {
			routingtable.each(this.callback);
			
			test.ok(!this.callback.called);
			test.done();
		},
		
		"should iterate over peers in a two-peer table with same common prefix" : function(test) {
			routingtable.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingtable.updateRoutingTable('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			
			routingtable.each(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.deepEqual(this.callback.args[0][0], {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'});
			test.equal(this.callback.args[0][1], '1');
			test.equal(this.callback.args[0][2], '7');
			test.deepEqual(this.callback.args[1][0], {id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456'});
			test.equal(this.callback.args[1][1], '1');
			test.equal(this.callback.args[1][2], '8');
			test.done();
		},
		
		"should iterate over peers in a two-peer table with different common prefixes" : function(test) {
			routingtable.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingtable.updateRoutingTable('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			
			routingtable.each(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.deepEqual(this.callback.args[0][0], {id:"C695A1A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456'});
			test.equal(this.callback.args[0][1], '0');
			test.equal(this.callback.args[0][2], 'C');
			test.deepEqual(this.callback.args[1][0], {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'});
			test.equal(this.callback.args[1][1], '1');
			test.equal(this.callback.args[1][2], '7');
			test.done();
		},
		
		"should do nothing when iterating over rows in empty routing table" : function(test) {
			routingtable.eachRow(this.callback);
			
			test.ok(!this.callback.called);
			test.done();
		},
		
		"should iterate over rows in a two-peer table with same common prefix" : function(test) {
			routingtable.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingtable.updateRoutingTable('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			
			routingtable.eachRow(this.callback);
			
			test.ok(this.callback.calledOnce);
			test.equal(this.callback.args[0][0], 1);
			test.deepEqual(this.callback.args[0][1], {
				'7' : {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'},
				'8' : {id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456'}
				});
			test.done();
		},
		
		"should iterate over rows in a two-peer table with different common prefixes" : function(test) {
			routingtable.updateRoutingTable('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012');
			routingtable.updateRoutingTable('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			
			routingtable.eachRow(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.equal(this.callback.args[0][0], 0);
			test.deepEqual(this.callback.args[0][1], {'C' : {id:"C695A1A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456'}});
			test.equal(this.callback.args[1][0], 1);
			test.deepEqual(this.callback.args[1][1], {'7' : {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012'}});
			test.done();
		}
	}),
	
	"getting the routing table row shared with another peer's routing table" : testCase({
		setUp : function(done) {
			routingtable.routingTable = {};
			leafset.reset();
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			routingtable.routingTable = {};
			done();
		},
		
		"should return empty shared row for empty routing table" : function(test) {			
			var res = routingtable.getSharedRow(higherId);

			test.deepEqual({'1' : {}}, res);
			test.done();
		},
		
		"should return empty shared row for routing with irrelevant entries" : function(test) {
			routingtable.updateRoutingTable(oneMoreId, '1.1.1.1:1111');
			routingtable.updateRoutingTable(oneLessId, '1.1.1.1:1111');
			
			var res = routingtable.getSharedRow(higherId);

			test.deepEqual({'1' : {}}, res);
			test.done();
		},
		
		"should return first row as shared row when no digits in common" : function(test) {			
			routingtable.updateRoutingTable(wrappedId, '1.1.1.1:1111');
			
			var res = routingtable.getSharedRow(lowerId);
			
			test.strictEqual(wrappedId, res['0']['0'].id);
			test.done();
		},
		
		"should return second row as shared row when one digit in common" : function(test) {
			routingtable.updateRoutingTable('E999999999999999999999999999999999999999', '0.0.0.0:0000');
			routingtable.updateRoutingTable('F711111111111111111111111111111111111111', '1.1.1.1:1111');
			routingtable.updateRoutingTable('F822222222222222222222222222222222222222', '2.2.2.2:2222');
			routingtable.updateRoutingTable('F433333333333333333333333333333333333333', '3.3.3.3:3333');
			
			var res = routingtable.getSharedRow(higherId);
			
			test.equal(1, Object.keys(res).length);
			test.equal(2, Object.keys(res['1']).length);
			test.strictEqual('F711111111111111111111111111111111111111', res['1']['7'].id);
			test.strictEqual('F822222222222222222222222222222222222222', res['1']['8'].id);
			test.done();
		}
	})
};