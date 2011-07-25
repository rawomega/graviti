var assert = require('assert');
var ringutil = require('ringutil');
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
	"uri parsing" : testCase({
		"should throw on no scheme" : function(test) {
			assert.throws(function() { ringutil.parseUri('abcdef/myresource'); }, /uri scheme/ );
			test.done();
		},
		
		"should throw on bad scheme" : function(test) {
			assert.throws(function() { ringutil.parseUri('bogus:abcdef/myresource'); }, /uri scheme/);
			test.done();
	    },
		
	    "should throw on no resource" : function(test) {
	    	assert.throws(function() {ringutil.parseUri('p2p:abcdef-noresource');}, /resource/);
	    	test.done();
	    },
		
	    "should throw on missing app name" : function(test) {
            assert.throws(function() {ringutil.parseUri('p2p:/myresource');}, /id/);
            test.done();
	    },
		
	    "should parse correctly" : function(test) {
			var parsedUri = ringutil.parseUri('p2p:myapp/documents/xyz');
			
			test.strictEqual('p2p', parsedUri.scheme);
			test.strictEqual('myapp', parsedUri.app_name);
			test.strictEqual('/documents/xyz', parsedUri.resource);
			test.strictEqual('A097B13EA2C82D0C2C09DE186E048D1EFF2537D2', parsedUri.hash);
			test.done();
		}
	}),
	
	"id generation" : testCase({
		"default id length should be 160 bits" : function(test) {
			assert.strictEqual(160, ringutil.lengthBits);
			test.done();
		},
		
		"should generate uuid" : function(test) {
			var res = ringutil.generateUuid();
	
			test.ok(/[A-F]+/.test(res));
			test.ok(res.replace(/-/g, '').length === 32);
			test.ok(res.replace(/[^-]/g, '').length === 4);			
			test.done();
		},
		
		"should generate node id" : function(test) {
			var res = ringutil.generateNodeId();

			test.ok(res.length === 40);			
			test.done();
		},
		
		"should not generate dupes for a relatively small # of ids in quick succession" : function(test) {
			var ids = {};
			
			for (var i = 0; i < 10000; i++) {
				var newId = ringutil.generateNodeId();
				if (ids[newId] !== undefined)
					test.fail('id ' + newId + ' already generated!');
				else
					ids[newId] = 'yay';
			}
			
			test.done();
		}
	}),
	
	"id bigint conversion and padding" : testCase({
		"should convert id to bigint" : function(test) {
			var res = ringutil.id2Bigint('8000000000000000000000000000000000000000');
			
			test.ok(bigint.equals(
					bigint.str2bigInt('8000000000000000000000000000000000000000', 16), res));
			test.done();
		},
		
		"should convert bigint to id and not pad when not required" : function(test) {
			var res = ringutil.bigint2Id(bigint.str2bigInt('8000000000000000000000000000000000000000', 16));
			
			test.equals('8000000000000000000000000000000000000000', res);
			test.done();
		},
		
		"should convert bigint to id and pad when required" : function(test) {
			var res = ringutil.bigint2Id(bigint.str2bigInt('0000440000000000000000000000000000000000', 16));
			
			test.equals('0000440000000000000000000000000000000000', res);
			test.done();
		}
	}),
	
	"common id prefix calcluation" : testCase({
		"detect that there is no common prefix in two different ids" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', 'bcc');
			
			test.equal(0, res);
			test.done();
		},		
		
		"detect common prefix from two different ids, ignoring casing" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', 'ABD');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect common prefix between two different ids where one is longer" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', 'abde');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect common prefix between two identical ids" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', 'ABC');
			
			test.equal(3, res);
			test.done();
		},
		
		"detect common prefix for two ids where one is the prefix of another" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', 'ABCde');
			
			test.equal(3, res);
			test.done();
		},
		

		"detect common prefix for two different ids where one is empty" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect common prefix for two different ids where both are empty" : function(test) {
			var res = ringutil.getCommonPrefixLength('', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect common prefix for two different ids where one is undefined" : function(test) {
			var res = ringutil.getCommonPrefixLength('abc', undefined);
			
			test.strictEqual(0, res);
			test.done();
		}
	}),
	
	"id abbreviation" : testCase({
		"should not blow up on undefined" : function(test) {
			test.strictEqual(undefined, ringutil.idAsShortString(undefined));
			test.done();
		},
		
		"should abbreviate id" : function(test) {
			test.strictEqual('123..DEF', ringutil.idAsShortString('1234ABCD89092093ABCDEF'));
			test.done();
		}
	}),
	
	"id calculations" : testCase({
		"should get highest possible id as bigint" : function(test) {
			var res = ringutil.getHighestPossibleIdAsBigint();
			
			test.strictEqual('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', bigint.bigInt2str(res, 16));
			test.done();
		},
		
		"should get id space size as bigint" : function(test) {
			var res = ringutil.getIdSpaceSizeAsBigint();
			
			test.strictEqual('10000000000000000000000000000000000000000', bigint.bigInt2str(res, 16));
			test.done();
		},
		
		"highest possible id and id space size should be just one id apart" : function(test) {
			var highest = ringutil.getHighestPossibleIdAsBigint();
			var size = ringutil.getIdSpaceSizeAsBigint();
			
			test.ok(bigint.equals(bigint.add(highest, bigint.str2bigInt('1', 16)), size));
			test.done();
		},
		
		"should get halfway point on ring" : function(test) {
			var biggest = ringutil.getHighestPossibleIdAsBigint();
			var one = bigint.str2bigInt('1', 16);
			var wrapAroundId = bigint.add(biggest, one);
			
			var res = ringutil.getHalfwayPointAsBigint();
			
			test.strictEqual('8000000000000000000000000000000000000000', bigint.bigInt2str(res, 16));
			test.strictEqual(
					bigint.bigInt2str(wrapAroundId, 16),
					bigint.bigInt2str(bigint.add(res, res), 16)
			);
			test.done();
		},
		
		"should get diametrically opposite point for low value" : function(test) {
			var res = ringutil.getDiametricallyOppositeId('00FF0000000000000000000000000000000000CC');
			
			test.strictEqual('80FF0000000000000000000000000000000000CC', res);
			test.done();
		},
		
		"should get diametrically opposite point for high value" : function(test) {			
			var res = ringutil.getDiametricallyOppositeId('ECC00000000000000000000000000000000000A0');
			
			test.strictEqual('6CC00000000000000000000000000000000000A0', res);
			test.done();
		},
		
		"should get diametrically opposite point for zero" : function(test) {			
			var res = ringutil.getDiametricallyOppositeId('0000000000000000000000000000000000000000');
			
			test.strictEqual('8000000000000000000000000000000000000000', res);
			test.done();
		},
		
		"should get diametrically opposite point for close to halfway value" : function(test) {			
			var res = ringutil.getDiametricallyOppositeId('8765000000000000000000000000000000000000');
			
			test.strictEqual('0765000000000000000000000000000000000000', res);
			test.done();
		},
		
		"should get diametrically opposite point for halfway value" : function(test) {			
			var res = ringutil.getDiametricallyOppositeId('8000000000000000000000000000000000000000');
			
			test.strictEqual('0000000000000000000000000000000000000000', res);
			test.done();
		}
	}),
	
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
