var assert = require('assert');
var ringutil = require('overlay/pastry/ringutil');
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
var slightlyLessNearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB'; 

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
	
//	"finding highest and lowest from a set of ids" : testCase({
//		"should find highest and lowest from a single id" : function(test) {
//			var res = ringutil.getHighestAndLowestIds([anId]);
//			
//			test.equal(anId, res.highest);
//			test.equal(anId, res.lowest);
//			test.done();
//		},
//		
//		"should find highest and lowest from a set of ids" : function(test) {
//			var res = ringutil.getHighestAndLowestIds([anId, higherId, lowerId, wrappedId]);
//			
//			test.equal(higherId, res.highest);
//			test.equal(wrappedId, res.lowest);
//			test.ok(bigint.equals(bigint.str2bigInt(higherId, 16), res.highestBigint));
//			test.ok(bigint.equals(bigint.str2bigInt(wrappedId, 16), res.lowestBigint));
//			test.done();
//		},
//		
//		"should find highest and lowest from a set of object key ids" : function(test) {
//			var obj = {};
//			obj[anId] = 'moo';
//			obj[higherId] = 'baa';
//			obj[lowerId] = 'oink';
//			
//			var res = ringutil.getHighestAndLowestIds(obj);
//			
//			test.equal(higherId, res.highest);
//			test.equal(lowerId, res.lowest);
//			test.ok(bigint.equals(bigint.str2bigInt(higherId, 16), res.highestBigint));
//			test.ok(bigint.equals(bigint.str2bigInt(lowerId, 16), res.lowestBigint));
//			test.done();
//		},
//		
//		"should find highest and lowest from a large set of ids" : function(test) {
//			var ids = ['24C09ED388054DD99B069429C6CEA3C8B9444F12','BC6150ACA54D43D18549BE204BAC4BC4FC293BC5',
//			           'B51A6DFDC18741BB93FEBEF98C60A1B807B0EAD6','776CC652D11C4455AF00256E18FB4F2D36CC8943',
//			           '67E7A41B496A4409AEC53C021096B2AF0A834431','165997A1070C495ABE98D85818BD62239C7850D5',
//			           '50B5DEFDABF84D7898D86A78ADA6B147DF5E863B','BD94B2126F034CF4883F77E37DCB79C513D7F18E',
//			           '5EA01D128DEF44F1A30C8B380E9113E9B0DBB068','C8167BE955324C758FAB81A137B86E10AC3D39F8',
//			           '71DAE0B9D15C484F995F529B5A119A019EA3C89F','422810DDE9C247F6828432979A79A5AE4CEEF7C6',
//			           'F0A6561CD2E4447E9D20A0FFCA75B51F7EB07061','2CAE146D724E404B8287484F6154432F9B05343F',
//			           'E31D5A75BF714CECB41A8E35EB29ED5C7D166B8B','7A3A5E65AD084BE49B5441F866E655E34EAEE799',
//			           'E4C0718D085842B990C83B935BDFEAFB78160746','6CEBDCC34C644D90B056B12F67EC5A71203CD138',
//			           '86C0363D803C4FDDAEA29E6B4C46C08004E4750B','5B99B73A37734A549913F98719FCF504EF793125',
//			           '1DA06163CCE4479BB071FEF8BBFBF2579F5EB7BE'];
//			
//			var res = ringutil.getHighestAndLowestIds(ids);
//			
//			test.equal('F0A6561CD2E4447E9D20A0FFCA75B51F7EB07061', res.highest);
//			test.equal('165997A1070C495ABE98D85818BD62239C7850D5', res.lowest);
//			test.ok(bigint.equals(bigint.str2bigInt('F0A6561CD2E4447E9D20A0FFCA75B51F7EB07061', 16), res.highestBigint));
//			test.ok(bigint.equals(bigint.str2bigInt('165997A1070C495ABE98D85818BD62239C7850D5', 16), res.lowestBigint));
//			test.done();
//		}
//	}),
	
	"sorting ids by distance and cw / ccw direction" : testCase({
		"should return empty array for empty set" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, []);
			
			test.deepEqual([], res);
			test.done();
		},
		
		"should return ref id if that is the only member of set" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [anId]);
			
			test.deepEqual([anId], res);
			test.done();
		},
		
		"should return correct ordering for simple clockwise search" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [anId, oneMoreId], true);
			
			test.deepEqual([anId, oneMoreId], res);
			test.done();
		},
		
		"should return correct ordering for simple anti-clockwise search" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [lowerId, oneLessId], false);
			
			test.deepEqual([oneLessId, lowerId], res);
			test.done();
		},
		
		"should default to clockwise search if cw / ccw flag not set" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [higherId, oneMoreId]);
			
			test.deepEqual([oneMoreId, higherId], res);
			test.done();
		},
		
		"should return correct ordering for clockwise search that wraps" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [wrappedId, lowerId], true);
			
			test.deepEqual([wrappedId, lowerId], res);
			test.done();
		},
		
		"should return correct ordering for counter-clockwise search that wraps" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [wrappedId, lowerId], false);
			
			test.deepEqual([lowerId, wrappedId], res);
			test.done();
		},
		
		"should handle duplicate ids when sorting but then eliminate them" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [lowerId, higherId, wrappedId, lowerId, oneLessId], true);
			
			test.deepEqual([higherId, wrappedId, lowerId, oneLessId], res);
			test.done();
		},
		
		"should handle a cluster of close-together ids sorted clockwise" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [oneMoreId, wrappedId, oneLessId], true);
			
			test.deepEqual([oneMoreId, wrappedId, oneLessId], res);
			test.done();
		},
		
		"should handle a cluster of close-together ids sorted counter-clockwise" : function(test) {
			var res = ringutil.sortByIncreasingDistance(anId, [oneMoreId, wrappedId, oneLessId], false);
			
			test.deepEqual([oneLessId, wrappedId, oneMoreId], res);
			test.done();
		}
	})
};