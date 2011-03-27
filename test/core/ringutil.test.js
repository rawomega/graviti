var assert = require('assert');
var ringutil = require('core/ringutil');
var bigint = require('thirdparty/bigint');
var testCase = require('nodeunit').testCase;

var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';
var nearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE';
var overEdgeId= '0000000000000000000000000000000000000001';
var slightlyLessNearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC'; 

module.exports = {
	"finding nearest id in ring" : testCase({
		"should reject bad dest id length" : function(test) {
			assert.throws(function(){ ringutil.getNearestId('123', []);}, /invalid id length/i);
	    	test.done();
		},
		
		"should reject bad ids length" : function(test) {
			assert.throws(function(){ ringutil.getNearestId(anId, ['4567']);}, /invalid id length/i);
	    	test.done();
		},
	
		"should find no nearest id when id set undefined" : function(test) {
			test.strictEqual(undefined, ringutil.getNearestId(anId, undefined).nearest);
			test.done();
		},
		
		"should find no nearest id when id set empty" : function(test) {
			test.strictEqual(undefined, ringutil.getNearestId(anId, []).nearest);
			test.done();
		},
		
		"should find nearest id when id set contains self" : function(test) {
			var res = ringutil.getNearestId(anId, [anId]);
			
			test.strictEqual(anId, res.nearest);
			test.strictEqual(anId, res.highest);
			test.strictEqual(anId, res.lowest);
			test.done();
		},
		
		"should find nearest id when id set contains higher id"  : function(test) {
			var res = ringutil.getNearestId(anId, [higherId]);
			
			test.strictEqual(higherId, res.nearest);
			test.strictEqual(higherId, res.highest);
			test.strictEqual(higherId, res.lowest);
			test.done();
		},
		
		"should find nearest id when id set contains lower id"  : function(test) {
			var res = ringutil.getNearestId(anId, [lowerId]);
			
			test.strictEqual(lowerId, res.nearest);
			test.strictEqual(lowerId, res.highest);
			test.strictEqual(lowerId, res.lowest);
			test.done();
		},
		
		"should find nearest id when it is wrapped CW" : function(test) {
			var res = ringutil.getNearestId(anId, [lowerId, wrappedId]);
			
			test.strictEqual(wrappedId, res.nearest);
			test.strictEqual(lowerId, res.highest);
			test.strictEqual(wrappedId, res.lowest);
			test.done();
		},
		
		"should find nearest id when wrapping not allowed" : function(test) {
			var res = ringutil.getNearestId(anId, [lowerId, wrappedId], false);
			
			test.strictEqual(lowerId, res.nearest);
			test.strictEqual(lowerId, res.highest);
			test.strictEqual(wrappedId, res.lowest);
			test.done();
		},
		
		"should find nearest id when wrapping not allowed with specific idss" : function(test) {
			var res = ringutil.getNearestId('C000000000000000000000000000000000000000',
					["ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234","B000000000000000000000000000000000000000"], false);
			
			test.strictEqual('B000000000000000000000000000000000000000', res.nearest);
			test.strictEqual('B000000000000000000000000000000000000000', res.highest);
			test.strictEqual('ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234', res.lowest);
			test.done();
		},
		
		"should find nearest id from three" : function(test) {
			var res = ringutil.getNearestId(anId, [lowerId, higherId, wrappedId]);
			
			test.strictEqual(higherId, res.nearest);
			test.strictEqual(higherId, res.highest);
			test.strictEqual(wrappedId, res.lowest);
			test.done();
		},		
		
		"should find nearest id from three without wrapping" : function(test) {
			var res = ringutil.getNearestId(anId, [lowerId, higherId, wrappedId], false);
			
			test.strictEqual(higherId, res.nearest);
			test.strictEqual(higherId, res.highest);
			test.strictEqual(wrappedId, res.lowest);
			test.done();
		},
		
		"should find nearest id from another three where nearest id is wrapped" : function(test) {
			var res = ringutil.getNearestId(lowerId, [oneLessId, higherId, wrappedId]);
			
			test.strictEqual(wrappedId, res.nearest);
			test.strictEqual(higherId, res.highest);
			test.strictEqual(wrappedId, res.lowest);
			test.done();
		},
		
		"should find nearest id from another three where wrapping is ignored": function(test) {
			var res = ringutil.getNearestId(lowerId, [oneLessId, higherId, wrappedId], false);
			
			test.strictEqual(wrappedId, res.nearest);
			test.strictEqual(higherId, res.highest);
			test.strictEqual(wrappedId, res.lowest);
			test.done();
		},
		
		"should give nearest id clockwise when same distance" : function(test) {
			var resLowerFirst = ringutil.getNearestId(anId, [oneLessId, oneMoreId]);
			var resHigherFirst = ringutil.getNearestId(anId, [oneMoreId, oneLessId]);
			
			test.strictEqual(oneMoreId, resLowerFirst.nearest);
			test.strictEqual(oneMoreId, resHigherFirst.nearest);
			test.done();
		},
		
		"should give nearest id clockwise when same distance with wraparound" : function(test) {
			var resLowerFirst = ringutil.getNearestId(nearEdgeId, [slightlyLessNearEdgeId, overEdgeId]);
			var resHigherFirst = ringutil.getNearestId(nearEdgeId, [overEdgeId, slightlyLessNearEdgeId]);
			
			test.strictEqual(overEdgeId, resLowerFirst.nearest);
			test.strictEqual(overEdgeId, resHigherFirst.nearest);
			test.done();
		},
		
		"should find nearest id from an associative array by looking at keys" : function(test) {
			var obj = {};
			obj[anId] = 'garbage to be ignored';
			
			var res = ringutil.getNearestId(anId, obj);
			
			test.strictEqual(anId, res.nearest);
			test.strictEqual(anId, res.highest);
			test.strictEqual(anId, res.lowest);
			test.done();
		}
	}),
	
	"finding furthest id in a ring" : testCase({
		"should find furthest id from an empty set" : function(test) {
			var res = ringutil.getFurthestId(anId, [], false);
			
			test.strictEqual(undefined, res);
			test.done();
		},
		
		"should be able to find furthest id from an unknown id" : function(test) {
			var res = ringutil.getFurthestId(anId, [higherId], false);
			
			test.strictEqual(higherId, res);
			test.done();
		},
		
		"furthest id from single element id set should be that id" : function(test) {
			var res = ringutil.getFurthestId(anId, [anId], false);
			
			test.strictEqual(anId, res);
			test.done();
		},
		
		"should find furthest id from a set of ids" : function(test) {
			var res = ringutil.getFurthestId(anId, [higherId, lowerId, nearEdgeId], false);
			
			test.strictEqual(lowerId, res);
			test.done();
		},
		
		"should find furthest id from a set of ids with wrap" : function(test) {
			var res = ringutil.getFurthestId(higherId, [nearEdgeId, overEdgeId, wrappedId], false);
			
			test.strictEqual(wrappedId, res);
			test.done();
		}
	}),

	"determining if given id is nearest to a specific id" : testCase ({

		"should determine if given id is nearest to own id than any leafset ids when no leafset" : function(test) {
			test.ok(ringutil.amINearest(higherId, anId, undefined));
			test.done();
		},
		
		"should determine if given id is nearest to own id than any leafset ids when leafset empty" : function(test) {
			test.ok(ringutil.amINearest(higherId, anId, {}));
			test.done();
		},
		
		"should determine if given id is nearest to own id than any leafset ids when leafset contains own id": function(test) {
			var arg = {};
			arg[anId] = '1.2.3.4:1234';
			
			test.ok(ringutil.amINearest(higherId, anId, arg));
			test.done();
		},

		"should determine if given id is nearest to own id than any leafset ids when leafset contains further id": function(test) {
			var arg = {};
			arg[lowerId] = '5.6.7.8:5678';
			
			test.ok(ringutil.amINearest(higherId, anId, arg));
			test.done();
		},
		
		"should determine if given id is nearest to own id than any leafset ids when leafset contains nearer id": function(test) {
			test.strictEqual(false, ringutil.amINearest(higherId, anId, [oneMoreId, lowerId]));
			test.done();
		}
	}),
	
	"finding highest and lowest from a set of ids" : testCase({
		"should find highest and lowest from a single id" : function(test) {
			var res = ringutil.getHighestAndLowestIds([anId]);
			
			test.equal(anId, res.highest);
			test.equal(anId, res.lowest);
			test.done();
		},
		
		"should find highest and lowest from a set of ids" : function(test) {
			var res = ringutil.getHighestAndLowestIds([anId, higherId, lowerId, wrappedId]);
			
			test.equal(higherId, res.highest);
			test.equal(wrappedId, res.lowest);
			test.done();
		},
		
		"should find highest and lowest from a set of object key ids" : function(test) {
			var obj = {};
			obj[anId] = 'moo';
			obj[higherId] = 'baa';
			obj[lowerId] = 'oink';
			
			var res = ringutil.getHighestAndLowestIds(obj);
			
			test.equal(higherId, res.highest);
			test.equal(lowerId, res.lowest);
			test.done();
		}
	})
};