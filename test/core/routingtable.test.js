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
	"updating the routing table with a known good peer" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			routingtable._candidatePeers = {};
			routingtable._table = {};
			done();
		},
		
		'updating with any known good peer should remove that peers id from candidate peer set if present' : function(test) {
			routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234', 10);
			
			test.deepEqual({}, routingtable._candidatePeers);
			test.done();
		},
		
		"update empty routing table with known good id with no bits in common with node id" : function(test) {
			routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234', 10);
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'1.2.3.4:1234', rtt: 10}}
			}, routingtable._table);
			test.done();
		},
		
		"update empty routing table with known good id with 1 bit in common with node id" : function(test) {
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234', 10);
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 10}}
			}, routingtable._table);
			test.done();
		},
		
		"update empty routing table with known good id equal to the node id" : function(test) {
			routingtable.updateWithKnownGood(anId, '1.2.3.4:1234', 10);
			
			test.deepEqual({}, routingtable._table);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a different prefix" : function(test) {
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234', 11);
			
			routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678', 22);
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'5.6.7.8:5678', rtt : 22}},
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt : 11}}
			}, routingtable._table);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a common prefix" : function(test) {
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234', 11);
			
			routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678', 22);
			
			test.deepEqual({
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 11},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678', rtt: 22}
				}
			}, routingtable._table);
			test.done();
		},
		
		"routing table entry does not get altered by a new entry with same prefix but longer round trip time" : function(test) {
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234', 11);
			
			routingtable.updateWithKnownGood('F78147A002B4482EB6D912E3E6518F5CC80EBEE6','5.6.7.8:5678', 22);
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 11}}
			}, routingtable._table);
			test.done();
		},
		
		"routing table entry should get replaced by a new entry with the same prefix and shorter round trip time" : function(test) {
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234', 11);
			
			routingtable.updateWithKnownGood('F78147A002B4482EB6D912E3E6518F5CC80EBEE6','5.6.7.8:5678', 6);
			
			test.deepEqual({
				"1":{"7":{id:"F78147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678', rtt : 6}}
			}, routingtable._table);
			test.done();
		},
		
		"routing table entry should get replaced by a new entry for the same id, even when rtt longer" : function(test) {
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234', 11);
			
			routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','5.6.7.8:5678', 22);
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'5.6.7.8:5678', rtt : 22}}
			}, routingtable._table);
			test.done();
		}
	}),
		
	"updating the routing table with provisional peers" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			routingtable._candidatePeers = {};
			routingtable._table = {};			
			done();
		},
		
		"update routing table with nothing" : function(test) {
			routingtable.updateWithProvisional(undefined);
			
			test.equal(0, Object.keys(routingtable._candidatePeers).length);
			test.done();
		},

		"update routing table with a new provisional peer" : function(test) {
			routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.equal(1, Object.keys(routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"update routing table with a provisional peer that is already known" : function(test) {
			routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.equal(1, Object.keys(routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},

		"update routing table with a provisional peer that is already known but has a different address" : function(test) {
			routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt = 123;
			
			routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678');
			
			test.equal(1, Object.keys(routingtable._candidatePeers).length);
			test.strictEqual('5.6.7.8:5678', routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(123 < routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"update empty routing table with the id equal to the node id" : function(test) {
			routingtable.updateWithProvisional(anId, '1.2.3.4:1234');
			
			test.deepEqual({}, routingtable._candidatePeers);
			test.done();
		},

		"update with provisional peers by passing multiple nodes at once" : function(test) {
			routingtable.updateWithProvisional({
				'F7DB7ACE15254C87B81D05DA8FA49588540B1950' : '1.2.3.4:1234',
				'F8D147A002B4482EB6D912E3E6518F5CC80EBEE6' : '5.6.7.8:5678'
			});
			
			test.equal(2, Object.keys(routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].ap);
			test.strictEqual('5.6.7.8:5678', routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].foundAt);
			test.ok(0 < routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		}
	}),

	"merging another routing table into our one" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			routingtable._candidatePeers = {};
			routingtable._table = {};			
			done();
		},
		
		"should merge empty routing table into empty" : function(test) {
			routingtable.mergeProvisional({});
			
			test.deepEqual({}, routingtable._table);
			test.deepEqual({}, routingtable._candidatePeers);
			test.done();
		},
		
		"should merge non-empty routing table into empty" : function(test) {
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			routingtable.mergeProvisional(rt);
			
			test.equal(2, Object.keys(routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].ap);
			test.strictEqual('5.6.7.8:5678', routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].foundAt);
			test.ok(0 < routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"should merge non-empty routing table into non-empty" : function(test) {
			routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			routingtable.mergeProvisional(rt);
			
			test.equal(3, Object.keys(routingtable._candidatePeers).length);
			test.strictEqual('3.4.5.6:3456', routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.strictEqual('1.2.3.4:1234', routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].ap);
			test.strictEqual('5.6.7.8:5678', routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.ok(0 < routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].foundAt);
			test.ok(0 < routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		}
	}),
	
	"clearing expired candidate peers" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			routingtable._candidatePeers = {};
			routingtable._table = {};			
			done();
		},
		
		"leave unexpired candidate peer" : function(test) {
			routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');			
			
			routingtable.clearExpiredCandidatePeers();
			
			test.equal(1, Object.keys(routingtable._candidatePeers).length);
			test.equal('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6', Object.keys(routingtable._candidatePeers).shift());
			test.done();
		},
		
		"remove expired candidate peer" : function(test) {
			routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');			
			routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt = new Date().getTime()
				- routingtable.candidatePeerRetentionIntervalMsec - 10000;
			
			routingtable.clearExpiredCandidatePeers();
			
			test.equal(0, Object.keys(routingtable._candidatePeers).length);
			test.done();
		}
	}),
	
	"iterating over peers in the routing table" : testCase({
		setUp : function(done) {
			node.nodeId = anId;
			var _this = this;
			this.callback = sinon.stub();
			done();
		},
		
		tearDown : function(done) {
			routingtable._candidatePeers = {};
			routingtable._table = {};
			sinon.collection.restore();
			done();
		},
		
		"should do nothing when iterating over peers empty routing table" : function(test) {
			routingtable.each(this.callback);
			
			test.ok(!this.callback.called);
			test.done();
		},
		
		"should iterate over peers in a two-peer table with same common prefix" : function(test) {
			routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			routingtable.each(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.deepEqual(this.callback.args[0][0], {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012', rtt:1});
			test.equal(this.callback.args[0][1], '1');
			test.equal(this.callback.args[0][2], '7');
			test.deepEqual(this.callback.args[1][0], {id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456', rtt:2});
			test.equal(this.callback.args[1][1], '1');
			test.equal(this.callback.args[1][2], '8');
			test.done();
		},
		
		"should iterate over peers in a two-peer table with different common prefixes" : function(test) {
			routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			routingtable.updateWithKnownGood('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			routingtable.each(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.deepEqual(this.callback.args[0][0], {id:"C695A1A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456', rtt:2});
			test.equal(this.callback.args[0][1], '0');
			test.equal(this.callback.args[0][2], 'C');
			test.deepEqual(this.callback.args[1][0], {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012', rtt:1});
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
			routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			routingtable.eachRow(this.callback);
			
			test.ok(this.callback.calledOnce);
			test.equal(this.callback.args[0][0], 1);
			test.deepEqual(this.callback.args[0][1], {
				'7' : {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012', rtt:1},
				'8' : {id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456', rtt:2}
				});
			test.done();
		},
		
		"should iterate over rows in a two-peer table with different common prefixes" : function(test) {
			routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			routingtable.updateWithKnownGood('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			routingtable.eachRow(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.equal(this.callback.args[0][0], 0);
			test.deepEqual(this.callback.args[0][1], {'C' : {id:"C695A1A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456', rtt:2}});
			test.equal(this.callback.args[1][0], 1);
			test.deepEqual(this.callback.args[1][1], {'7' : {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012', rtt:1}});
			test.done();
		},
		
		"should iterate over candidate peers" : function(test) {
			routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','1.2.3.4:1234');			
			routingtable.updateWithProvisional('F700000015254C87B81D05DA8FA49588540B1950','3.4.5.6:3456');			
			routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt = 111;
			routingtable._candidatePeers['F700000015254C87B81D05DA8FA49588540B1950'].foundAt = 222;
			
			routingtable.eachCandidate(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.ok(this.callback.calledWith('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6', {ap : '1.2.3.4:1234', foundAt : 111}));
			test.ok(this.callback.calledWith('F700000015254C87B81D05DA8FA49588540B1950', {ap : '3.4.5.6:3456', foundAt : 222}));
			test.done();
		}
	}),
	
	"getting the routing table row shared with another peer's routing table" : testCase({
		setUp : function(done) {
			leafset.reset();
			node.nodeId = anId;
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			routingtable._table = {};
			routingtable._candidatePeers = {};
			done();
		},
		
		"should return empty shared row for empty routing table" : function(test) {			
			var res = routingtable.getSharedRow(higherId);

			test.deepEqual({'1' : {}}, res);
			test.done();
		},
		
		"should return empty shared row for routing with irrelevant entries" : function(test) {
			routingtable.updateWithKnownGood(oneMoreId, '1.1.1.1:1111', 1);
			routingtable.updateWithKnownGood(oneLessId, '1.1.1.1:1111', 1);
			
			var res = routingtable.getSharedRow(higherId);

			test.deepEqual({'1' : {}}, res);
			test.done();
		},
		
		"should return first row as shared row when no digits in common" : function(test) {			
			routingtable.updateWithKnownGood(wrappedId, '1.1.1.1:1111', 1);
			
			var res = routingtable.getSharedRow(lowerId);
			
			test.strictEqual(wrappedId, res['0']['0'].id);
			test.done();
		},
		
		"should return second row as shared row when one digit in common" : function(test) {
			routingtable.updateWithKnownGood('E999999999999999999999999999999999999999', '0.0.0.0:0000', 0);
			routingtable.updateWithKnownGood('F711111111111111111111111111111111111111', '1.1.1.1:1111', 1);
			routingtable.updateWithKnownGood('F822222222222222222222222222222222222222', '2.2.2.2:2222', 2);
			routingtable.updateWithKnownGood('F433333333333333333333333333333333333333', '3.3.3.3:3333', 3);
			
			var res = routingtable.getSharedRow(higherId);
			
			test.equal(1, Object.keys(res).length);
			test.equal(2, Object.keys(res['1']).length);
			test.strictEqual('F711111111111111111111111111111111111111', res['1']['7'].id);
			test.strictEqual('F822222222222222222222222222222222222222', res['1']['8'].id);
			test.done();
		}
	})
};