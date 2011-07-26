var assert = require('assert');
var sinon = require('sinon');
var routingtable = require('pastry/routingtable');
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
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
//			this.routingtable._candidatePeers = {};
//			this.routingtable._table = {};
			done();
		},
		
		'updating with node id peer should do nothing' : function(test) {
			this.routingtable.updateWithKnownGood(anId, '1.2.3.4:1234', 10);
			
			test.deepEqual({}, this.routingtable._table);
			test.done();
		},
		
		'updating with any known good peer should remove that peers id from candidate peer set if present' : function(test) {
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234', 10);
			
			test.deepEqual({}, this.routingtable._candidatePeers);
			test.done();
		},
		
		'updating with a known good peer without a round trip time should set that time to a long value' : function(test) {
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'1.2.3.4:1234', rtt: 10000}}
			}, this.routingtable._table);
			test.done();
		},
		
		'updating with a known good peer without a round trip time should add that peer as provisional so it can be probed' : function(test) {
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			console.log('-- ' + JSON.stringify(this.routingtable._candidatePeers));
			test.deepEqual('1.2.3.4:1234', this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.done();
		},
		
		"update empty routing table with known good id with no bits in common with node id" : function(test) {
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234', 10);
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'1.2.3.4:1234', rtt: 10}}
			}, this.routingtable._table);
			test.done();
		},
		
		"update empty routing table with known good id with 1 bit in common with node id" : function(test) {
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234', 10);
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 10}}
			}, this.routingtable._table);
			test.done();
		},
		
		"update empty routing table with known good id equal to the node id" : function(test) {
			this.routingtable.updateWithKnownGood(anId, '1.2.3.4:1234', 10);
			
			test.deepEqual({}, this.routingtable._table);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a different prefix" : function(test) {
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234', 11);
			
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678', 22);
			
			test.deepEqual({
				"0":{"0":{id:'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6',ap:'5.6.7.8:5678', rtt : 22}},
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt : 11}}
			}, this.routingtable._table);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a common prefix" : function(test) {
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950', '1.2.3.4:1234', 11);
			
			this.routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678', 22);
			
			test.deepEqual({
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 11},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678', rtt: 22}
				}
			}, this.routingtable._table);
			test.done();
		},
		
		"routing table entry does not get altered by a new entry with same prefix but longer round trip time" : function(test) {
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234', 11);
			
			this.routingtable.updateWithKnownGood('F78147A002B4482EB6D912E3E6518F5CC80EBEE6','5.6.7.8:5678', 22);
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 11}}
			}, this.routingtable._table);
			test.done();
		},
		
		"routing table entry should get replaced by a new entry with the same prefix and shorter round trip time" : function(test) {
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234', 11);
			
			this.routingtable.updateWithKnownGood('F78147A002B4482EB6D912E3E6518F5CC80EBEE6','5.6.7.8:5678', 6);
			
			test.deepEqual({
				"1":{"7":{id:"F78147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678', rtt : 6}}
			}, this.routingtable._table);
			test.done();
		},
		
		"routing table entry should get replaced by a new entry for the same id, even when rtt longer" : function(test) {
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','1.2.3.4:1234', 11);
			
			this.routingtable.updateWithKnownGood('F7DB7ACE15254C87B81D05DA8FA49588540B1950','5.6.7.8:5678', 22);
			
			test.deepEqual({
				"1":{"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'5.6.7.8:5678', rtt : 22}}
			}, this.routingtable._table);
			test.done();
		}
	}),
	
	"updating the routing table with provisional peers" : testCase({
		setUp : function(done) {
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
//			this.routingtable._candidatePeers = {};
//			this.routingtable._table = {};			
			done();
		},
		
		"update routing table with nothing" : function(test) {
			this.routingtable.updateWithProvisional(undefined);
			
			test.equal(0, Object.keys(this.routingtable._candidatePeers).length);
			test.done();
		},

		"update routing table with a new provisional peer" : function(test) {
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.equal(1, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"update routing table with a provisional peer that is already known" : function(test) {
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.equal(1, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"do not update routing table with a provisional peer that is already a known good peer, when override flag not set" : function(test) {
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234', 1);
			
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			test.equal(0, Object.keys(this.routingtable._candidatePeers).length);
			test.done();
		},
		
		"update routing table with a provisional peer that is already a known good peer, when override flag set" : function(test) {
			this.routingtable.updateWithKnownGood('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234', true);
			
			test.equal(1, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},

		"update routing table with a provisional peer that is already known but has a different address" : function(test) {
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '1.2.3.4:1234');
			this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt = 123;
			
			this.routingtable.updateWithProvisional('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6', '5.6.7.8:5678');
			
			test.equal(1, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('5.6.7.8:5678', this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(123 < this.routingtable._candidatePeers['0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"update empty routing table with the id equal to the node id" : function(test) {
			this.routingtable.updateWithProvisional(anId, '1.2.3.4:1234');
			
			test.deepEqual({}, this.routingtable._candidatePeers);
			test.done();
		},

		"update with provisional peers by passing multiple nodes at once" : function(test) {
			this.routingtable.updateWithProvisional({
				'F7DB7ACE15254C87B81D05DA8FA49588540B1950' : '1.2.3.4:1234',
				'F8D147A002B4482EB6D912E3E6518F5CC80EBEE6' : '5.6.7.8:5678'
			});
			
			test.equal(2, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', this.routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].ap);
			test.strictEqual('5.6.7.8:5678', this.routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < this.routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].foundAt);
			test.ok(0 < this.routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		}
	}),

	"merging another routing table into our one" : testCase({
		setUp : function(done) {
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
//			this.routingtable._candidatePeers = {};
//			this.routingtable._table = {};			
			done();
		},
		
		"should merge empty routing table of provisional peers into empty" : function(test) {
			this.routingtable.mergeProvisional({});
			
			test.deepEqual({}, this.routingtable._table);
			test.deepEqual({}, this.routingtable._candidatePeers);
			test.done();
		},
		
		"should merge non-empty routing table with provisional peers into empty" : function(test) {
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			this.routingtable.mergeProvisional(rt);
			
			test.equal(2, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('1.2.3.4:1234', this.routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].ap);
			test.strictEqual('5.6.7.8:5678', this.routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < this.routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].foundAt);
			test.ok(0 < this.routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"should merge non-empty routing table with provisional peers into non-empty" : function(test) {
			this.routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234'},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			this.routingtable.mergeProvisional(rt);
			
			test.equal(3, Object.keys(this.routingtable._candidatePeers).length);
			test.strictEqual('3.4.5.6:3456', this.routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.strictEqual('1.2.3.4:1234', this.routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].ap);
			test.strictEqual('5.6.7.8:5678', this.routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].ap);
			test.ok(0 < this.routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.ok(0 < this.routingtable._candidatePeers['F7DB7ACE15254C87B81D05DA8FA49588540B1950'].foundAt);
			test.ok(0 < this.routingtable._candidatePeers['F8D147A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt);
			test.done();
		},
		
		"should merge empty routing table of known good peers into empty" : function(test) {
			this.routingtable.mergeKnownGood({});
			
			test.deepEqual({}, this.routingtable._table);
			test.deepEqual({}, this.routingtable._candidatePeers);
			test.done();
		},
		
		"should merge non-empty routing table with known good peers into empty" : function(test) {
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt : 111},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			this.routingtable.mergeKnownGood(rt);

			test.strictEqual('F7DB7ACE15254C87B81D05DA8FA49588540B1950', this.routingtable._table['1']['7'].id);
			test.strictEqual('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', this.routingtable._table['1']['8'].id);
			test.strictEqual('1.2.3.4:1234', this.routingtable._table['1']['7'].ap);
			test.strictEqual('5.6.7.8:5678', this.routingtable._table['1']['8'].ap);
			test.ok(111 === this.routingtable._table['1']['7'].rtt);
			test.ok(10000 === this.routingtable._table['1']['8'].rtt);
			test.done();
		},
		
		"should merge non-empty routing table with known good peers into non-empty" : function(test) {
			this.routingtable.updateWithKnownGood('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 333);
			var rt = {
				"1":{
					"7":{id:"F7DB7ACE15254C87B81D05DA8FA49588540B1950",ap:'1.2.3.4:1234', rtt: 111},
					"8":{id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'5.6.7.8:5678'}
				}
			};
			
			this.routingtable.mergeKnownGood(rt);
			
			test.strictEqual('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6', this.routingtable._table['0']['C'].id);
			test.strictEqual('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', this.routingtable._table['1']['8'].id);
			test.strictEqual('F7DB7ACE15254C87B81D05DA8FA49588540B1950', this.routingtable._table['1']['7'].id);
			test.strictEqual('3.4.5.6:3456', this.routingtable._table['0']['C'].ap);
			test.strictEqual('1.2.3.4:1234', this.routingtable._table['1']['7'].ap);
			test.strictEqual('5.6.7.8:5678', this.routingtable._table['1']['8'].ap);
			test.ok(333 === this.routingtable._table['0']['C'].rtt);
			test.ok(111 === this.routingtable._table['1']['7'].rtt);
			test.ok(10000 === this.routingtable._table['1']['8'].rtt);
			test.done();
		}
	}),
	
	"housekeeping local transient state" : testCase({
		setUp : function(done) {
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
//			this.routingtable._candidatePeers = {};
//			this.routingtable._table = {};
//			this.routingtable._proposedBetterRoutingHops = {};
			done();
		},
		
		"when clearing out expired candidate peers, leave unexpired candidate peer" : function(test) {
			this.routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');			
			
			this.routingtable.housekeep();
			
			test.equal(1, Object.keys(this.routingtable._candidatePeers).length);
			test.equal('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6', Object.keys(this.routingtable._candidatePeers).shift());
			test.done();
		},
		
		"when clearing out expired candidate peers, remove expired candidate peer" : function(test) {
			this.routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456');			
			this.routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt = Date.now()
				- this.routingtable.candidatePeerRetentionIntervalMsec - 10000;
			
			this.routingtable.housekeep();
			
			test.equal(0, Object.keys(this.routingtable._candidatePeers).length);
			test.done();
		},
		
		"when clearing out expired proposed routing hops, leave unexpired route" : function(test) {
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);			
			this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'C000000000000000000000000000000000000000');
			
			this.routingtable.housekeep();
			
			test.equal(1, Object.keys(this.routingtable._proposedBetterRoutingHops).length);
			test.equal('700000000000000000000000000000000000', Object.keys(this.routingtable._proposedBetterRoutingHops)[0]);
			test.done();
		},
		
		"clear out expired proposed routing hop" : function(test) {
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);			
			this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'C000000000000000000000000000000000000000');
			this.routingtable._proposedBetterRoutingHops['700000000000000000000000000000000000']['B000000000000000000000000000000000000000'] = Date.now() - 100 * 60000;
			
			this.routingtable.housekeep();
			
			test.equal(0, Object.keys(this.routingtable._proposedBetterRoutingHops).length);
			test.done();
		},
		
		"leave unaffected hops when clearing out expired proposed routing hop" : function(test) {
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			this.routingtable.updateWithKnownGood('C000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'D000000000000000000000000000000000000000');
			this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'D000000000000000000000000000000000000000');
			this.routingtable._proposedBetterRoutingHops['700000000000000000000000000000000000']['B000000000000000000000000000000000000000'] = Date.now() - 100 * 60000;
			
			this.routingtable.housekeep();
			
			test.equal(1, Object.keys(this.routingtable._proposedBetterRoutingHops).length);
			test.equal('C000000000000000000000000000000000000000', Object.keys(this.routingtable._proposedBetterRoutingHops['700000000000000000000000000000000000'])[0]);
			test.done();
		}
	}),
	
	"getting a peer from the rooting table" : testCase({
		setUp : function(done) {
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
//			this.routingtable._candidatePeers = {};
//			this.routingtable._table = {};
			sinon.collection.restore();
			done();
		},
		
		"should get nothing for a non-existent peer" : function(test) {
			var res = this.routingtable.peer('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234');
			
			test.equal(undefined, res);
			test.done();
		},
		
		"should get nothing for a non-matching peer" : function(test) {
			this.routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			var res = this.routingtable.peer('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234');
			
			test.equal(undefined, res);
			test.done();
		},
		
		"should get matching peer in zeroth row for a non-matching peer" : function(test) {
			this.routingtable.updateWithKnownGood('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			var res = this.routingtable.peer('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234');
			
			test.equal('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234', res.id);
			test.equal('9.0.1.2:9012', res.ap);
			test.done();
		},
		
		"should get matching peer in first row for a non-matching peer" : function(test) {
			this.routingtable.updateWithKnownGood('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			var res = this.routingtable.peer('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6');
			
			test.equal('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6', res.id);
			test.equal('3.4.5.6:3456', res.ap);
			test.done();
		}
	}),
	
	"iterating over peers in the routing table" : testCase({
		setUp : function(done) {
			var _this = this;
			this.callback = sinon.stub();
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
//			this.routingtable._candidatePeers = {};
//			this.routingtable._table = {};
			sinon.collection.restore();
			done();
		},
		
		"should do nothing when iterating over peers empty routing table" : function(test) {
			this.routingtable.each(this.callback);
			
			test.ok(!this.callback.called);
			test.done();
		},
		
		"should iterate over peers in a two-peer table with same common prefix" : function(test) {
			this.routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			this.routingtable.each(this.callback);
			
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
			this.routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			this.routingtable.each(this.callback);
			
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
			this.routingtable.eachRow(this.callback);
			
			test.ok(!this.callback.called);
			test.done();
		},
		
		"should iterate over rows in a two-peer table with same common prefix" : function(test) {
			this.routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			this.routingtable.eachRow(this.callback);
			
			test.ok(this.callback.calledOnce);
			test.equal(this.callback.args[0][0], 1);
			test.deepEqual(this.callback.args[0][1], {
				'7' : {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012', rtt:1},
				'8' : {id:"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456', rtt:2}
				});
			test.done();
		},
		
		"should iterate over rows in a two-peer table with different common prefixes" : function(test) {
			this.routingtable.updateWithKnownGood('F700000015254C87B81D05DA8FA49588540B1950','9.0.1.2:9012', 1);
			this.routingtable.updateWithKnownGood('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','3.4.5.6:3456', 2);
			
			this.routingtable.eachRow(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.equal(this.callback.args[0][0], 0);
			test.deepEqual(this.callback.args[0][1], {'C' : {id:"C695A1A002B4482EB6D912E3E6518F5CC80EBEE6",ap:'3.4.5.6:3456', rtt:2}});
			test.equal(this.callback.args[1][0], 1);
			test.deepEqual(this.callback.args[1][1], {'7' : {id:"F700000015254C87B81D05DA8FA49588540B1950",ap:'9.0.1.2:9012', rtt:1}});
			test.done();
		},
		
		"should iterate over candidate peers" : function(test) {
			this.routingtable.updateWithProvisional('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6','1.2.3.4:1234');			
			this.routingtable.updateWithProvisional('F700000015254C87B81D05DA8FA49588540B1950','3.4.5.6:3456');			
			this.routingtable._candidatePeers['C695A1A002B4482EB6D912E3E6518F5CC80EBEE6'].foundAt = 111;
			this.routingtable._candidatePeers['F700000015254C87B81D05DA8FA49588540B1950'].foundAt = 222;
			
			this.routingtable.eachCandidate(this.callback);
			
			test.ok(this.callback.calledTwice);
			test.ok(this.callback.calledWith('C695A1A002B4482EB6D912E3E6518F5CC80EBEE6', {ap : '1.2.3.4:1234', foundAt : 111}));
			test.ok(this.callback.calledWith('F700000015254C87B81D05DA8FA49588540B1950', {ap : '3.4.5.6:3456', foundAt : 222}));
			test.done();
		}
	}),

	"getting the routing table row shared with another peer's routing table" : testCase({
		setUp : function(done) {
			this.routingtable = new routingtable.RoutingTable(anId);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
//			leafset.reset();
//			this.routingtable._table = {};
//			this.routingtable._candidatePeers = {};
			done();
		},
		
		"should return empty shared row for empty routing table" : function(test) {			
			var res = this.routingtable.getSharedRow(higherId);

			test.deepEqual({'1' : {}}, res);
			test.done();
		},
		
		"should return empty shared row for routing with irrelevant entries" : function(test) {
			this.routingtable.updateWithKnownGood(oneMoreId, '1.1.1.1:1111', 1);
			this.routingtable.updateWithKnownGood(oneLessId, '1.1.1.1:1111', 1);
			
			var res = this.routingtable.getSharedRow(higherId);

			test.deepEqual({'1' : {}}, res);
			test.done();
		},
		
		"should return first row as shared row when no digits in common" : function(test) {			
			this.routingtable.updateWithKnownGood(wrappedId, '1.1.1.1:1111', 1);
			
			var res = this.routingtable.getSharedRow(lowerId);
			
			test.strictEqual(wrappedId, res['0']['0'].id);
			test.done();
		},
		
		"should return second row as shared row when one digit in common" : function(test) {
			this.routingtable.updateWithKnownGood('E999999999999999999999999999999999999999', '0.0.0.0:0000', 0);
			this.routingtable.updateWithKnownGood('F711111111111111111111111111111111111111', '1.1.1.1:1111', 1);
			this.routingtable.updateWithKnownGood('F822222222222222222222222222222222222222', '2.2.2.2:2222', 2);
			this.routingtable.updateWithKnownGood('F433333333333333333333333333333333333333', '3.3.3.3:3333', 3);
			
			var res = this.routingtable.getSharedRow(higherId);
			
			test.equal(1, Object.keys(res).length);
			test.equal(2, Object.keys(res['1']).length);
			test.strictEqual('F711111111111111111111111111111111111111', res['1']['7'].id);
			test.strictEqual('F822222222222222222222222222222222222222', res['1']['8'].id);
			test.done();
		}
	}),
	
	"finding a better hop than 'us' using information in our routing table" : testCase({
		setUp : function(done) {
			sinon.collection.stub(Date, 'now').returns(1234);
			this.routingtable = new routingtable.RoutingTable('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234');
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
//			leafset.reset();
//			this.routingtable._table = {};
//			this.routingtable._candidatePeers = {};
//			this.routingtable._proposedBetterRoutingHops = {};
			done();
		},
		
		"should return empty better hop for empty routing table" : function(test) {			
			var res = this.routingtable.findBetterRoutingHop(higherId);

			test.deepEqual(undefined, res);
			test.equal(0, Object.keys(this.routingtable._proposedBetterRoutingHops).length);
			test.done();
		},
	
		"should return nothing if we have nothing better than this node" : function(test) {		
			this.routingtable.updateWithKnownGood('8000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('900000000000000000000000000000000000', 'A000000000000000000000000000000000000000');

			test.deepEqual(undefined, res);
			test.equal(0, Object.keys(this.routingtable._proposedBetterRoutingHops).length);
			test.done();
		},
		
		"should return an entry that is better than this node in zeroth row" : function(test) {		
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'C000000000000000000000000000000000000000');

			test.deepEqual('B000000000000000000000000000000000000000', res.id);
			test.deepEqual('1.1.1.1:1111', res.ap);
			test.deepEqual(res.row, {
				'0' : { 'B' : {id : 'B000000000000000000000000000000000000000', ap : '1.1.1.1:1111', rtt : 1}}
			});
			test.done();
		},
		
		"should add a proposed entry to local cache" : function(test) {		
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'C000000000000000000000000000000000000000');

			test.deepEqual(this.routingtable._proposedBetterRoutingHops,
					{ '700000000000000000000000000000000000' : { 'B000000000000000000000000000000000000000' : 1234}});
			test.done();
		},

		"should not propose same entry twice in quick succession" : function(test) {		
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'C000000000000000000000000000000000000000');
			
			var res = this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'C000000000000000000000000000000000000000');

			test.deepEqual(undefined, res);
			test.equal(1, Object.keys(this.routingtable._proposedBetterRoutingHops).length);
			test.done();
		},
		
		"when two proposals required in quick succession, propose different entries when available" : function(test) {		
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			this.routingtable.updateWithKnownGood('C000000000000000000000000000000000000000', '2.2.2.2:2222', 2);
			
			var res1 = this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'D000000000000000000000000000000000000000');			
			var res2 = this.routingtable.findBetterRoutingHop('700000000000000000000000000000000000', 'D000000000000000000000000000000000000000');

			test.deepEqual('C000000000000000000000000000000000000000', res1.id);
			test.deepEqual('2.2.2.2:2222', res1.ap);
			test.deepEqual(res1.row, {
				'0' : {
					'B' : {id : 'B000000000000000000000000000000000000000', ap : '1.1.1.1:1111', rtt : 1},
					'C' : {id : 'C000000000000000000000000000000000000000', ap : '2.2.2.2:2222', rtt : 2}
				}
			});
			test.deepEqual('B000000000000000000000000000000000000000', res2.id);
			test.deepEqual('1.1.1.1:1111', res2.ap);
			test.deepEqual(res1.row, {
				'0' : {
					'B' : {id : 'B000000000000000000000000000000000000000', ap : '1.1.1.1:1111', rtt : 1},
					'C' : {id : 'C000000000000000000000000000000000000000', ap : '2.2.2.2:2222', rtt : 2}
				}
			});
			test.done();
		},
		
		"should return an entry that is better than this node in our first row" : function(test) {		
			this.routingtable.updateWithKnownGood('A300000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('A00000000000000000000000000000000000', 'A200000000000000000000000000000000000000');

			test.deepEqual('A300000000000000000000000000000000000000', res.id);
			test.deepEqual('1.1.1.1:1111', res.ap);
			test.deepEqual(res.row, {
				'1' : { '3' : {id : 'A300000000000000000000000000000000000000', ap : '1.1.1.1:1111', rtt : 1}}
			});
			test.done();
		},
		
		"should return nothing if our best route is no good to sender due to insufficiently long comon prefix" : function(test) {		
			this.routingtable.updateWithKnownGood('ABCD000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('A00000000000000000000000000000000000', 'AC00000000000000000000000000000000000000');

			test.deepEqual(undefined, res);
			test.done();
		},
		
		"should return an entry that is better than this node in our fourth row" : function(test) {		
			this.routingtable.updateWithKnownGood('ABCF000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('ABC000000000000000000000000000000000', 'AC00000000000000000000000000000000000000');

			test.deepEqual('ABCF000000000000000000000000000000000000', res.id);
			test.deepEqual('1.1.1.1:1111', res.ap);
			test.deepEqual(res.row, {
				'3' : { 'F' : {id : 'ABCF000000000000000000000000000000000000', ap : '1.1.1.1:1111', rtt : 1}}
			});
			test.done();
		},

		"given multiple matches, should prefer one with a longer shared prefix" : function(test) {		
			this.routingtable.updateWithKnownGood('ABCF000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			this.routingtable.updateWithKnownGood('ABF0000000000000000000000000000000000000', '2.2.2.2:2222', 2);
			
			var res = this.routingtable.findBetterRoutingHop('ABC000000000000000000000000000000000', 'AC00000000000000000000000000000000000000');

			test.deepEqual('ABCF000000000000000000000000000000000000', res.id);
			test.deepEqual('1.1.1.1:1111', res.ap);
			test.deepEqual(res.row, {
				'3' : { 'F' : {id : 'ABCF000000000000000000000000000000000000', ap : '1.1.1.1:1111', rtt : 1}}
			});
			test.done();
		},
		
		"should return nothing if our best route is further than us" : function(test) {		
			this.routingtable.updateWithKnownGood('AF00000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('A00000000000000000000000000000000000', 'AD00000000000000000000000000000000000000');

			test.deepEqual(undefined, res);
			test.done();
		},
		
		"should return nothing if we have a closer route but it doesn't have the right prefix" : function(test) {		
			this.routingtable.updateWithKnownGood('B000000000000000000000000000000000000000', '1.1.1.1:1111', 1);
			
			var res = this.routingtable.findBetterRoutingHop('A00000000000000000000000000000000000', 'AF00000000000000000000000000000000000000');

			test.deepEqual(undefined, res);
			test.done();
		}
	})
};