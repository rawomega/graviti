var assert = require('assert');
var id = require('common/id');
var bigint = require('thirdparty/bigint');
var testCase = require('nodeunit').testCase;

module.exports = {
	"id generation" : testCase({
		"default id length should be 160 bits" : function(test) {
			assert.strictEqual(160, id.lengthBits);
			test.done();
		},
		
		"should generate uuid" : function(test) {
			var res = id.generateUuid();
	
			test.ok(res.replace(/-/g, '').length === 32);
			test.ok(res.replace(/[^-]/g, '').length === 4);			
			test.done();
		},
		
		"should generate node id" : function(test) {
			var res = id.generateNodeId();

			test.ok(res.length === 40);			
			test.done();
		},
		
		"should not generate dupes for a relatively small # of ids in quick succession" : function(test) {
			var ids = {};
			
			for (var i = 0; i < 10000; i++) {
				var newId = id.generateNodeId();
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
			var res = id.id2Bigint('8000000000000000000000000000000000000000');
			
			test.ok(bigint.equals(
					bigint.str2bigInt('8000000000000000000000000000000000000000', 16), res));
			test.done();
		},
		
		"should convert bigint to id and not pad when not required" : function(test) {
			var res = id.bigint2Id(bigint.str2bigInt('8000000000000000000000000000000000000000', 16));
			
			test.equals('8000000000000000000000000000000000000000', res);
			test.done();
		},
		
		"should convert bigint to id and pad when required" : function(test) {
			var res = id.bigint2Id(bigint.str2bigInt('0000440000000000000000000000000000000000', 16));
			
			test.equals('0000440000000000000000000000000000000000', res);
			test.done();
		}
	}),
	
	"common id prefix calcluation" : testCase({
		"detect that there is no common prefix in two different ids" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'bcc');
			
			test.equal(0, res);
			test.done();
		},		
		
		"detect common prefix from two different ids, ignoring casing" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'ABD');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect common prefix between two different ids where one is longer" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'abde');
			
			test.equal(2, res);
			test.done();
		},
		
		"detect common prefix between two identical ids" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'ABC');
			
			test.equal(3, res);
			test.done();
		},
		
		"detect common prefix for two ids where one is the prefix of another" : function(test) {
			var res = id.getCommonPrefixLength('abc', 'ABCde');
			
			test.equal(3, res);
			test.done();
		},
		

		"detect common prefix for two different ids where one is empty" : function(test) {
			var res = id.getCommonPrefixLength('abc', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect common prefix for two different ids where both are empty" : function(test) {
			var res = id.getCommonPrefixLength('', '');
			
			test.equal(0, res);
			test.done();
		},
		
		"detect common prefix for two different ids where one is undefined" : function(test) {
			var res = id.getCommonPrefixLength('abc', undefined);
			
			test.strictEqual(0, res);
			test.done();
		}
	}),
	
	"id abbreviation" : testCase({
		"should not blow up on undefined" : function(test) {
			test.strictEqual(undefined, id.abbr(undefined));
			test.done();
		},
		
		"should abbreviate id" : function(test) {
			test.strictEqual('123..DEF', id.abbr('1234ABCD89092093ABCDEF'));
			test.done();
		}
	}),
	
	"id calculations" : testCase({
		"should get highest possible id as bigint" : function(test) {
			var res = id.getHighestPossibleIdAsBigint();
			
			test.strictEqual('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', bigint.bigInt2str(res, 16));
			test.done();
		},
		
		"should get halfway point on ring" : function(test) {
			var biggest = id.getHighestPossibleIdAsBigint();
			var one = bigint.str2bigInt('1', 16);
			var wrapAroundId = bigint.add(biggest, one);
			
			var res = id.getHalfwayPointAsBigint();
			
			test.strictEqual('8000000000000000000000000000000000000000', bigint.bigInt2str(res, 16));
			test.strictEqual(
					bigint.bigInt2str(wrapAroundId, 16),
					bigint.bigInt2str(bigint.add(res, res), 16)
			);
			test.done();
		},
		
		"should get diametrically opposite point for low value" : function(test) {
			var res = id.getDiametricOpposite('00FF0000000000000000000000000000000000CC');
			
			test.strictEqual('80FF0000000000000000000000000000000000CC', res);
			test.done();
		},
		
		"should get diametrically opposite point for high value" : function(test) {			
			var res = id.getDiametricOpposite('ECC00000000000000000000000000000000000A0');
			
			test.strictEqual('6CC00000000000000000000000000000000000A0', res);
			test.done();
		},
		
		"should get diametrically opposite point for zero" : function(test) {			
			var res = id.getDiametricOpposite('0000000000000000000000000000000000000000');
			
			test.strictEqual('8000000000000000000000000000000000000000', res);
			test.done();
		},
		
		"should get diametrically opposite point for close to halfway value" : function(test) {			
			var res = id.getDiametricOpposite('8765000000000000000000000000000000000000');
			
			test.strictEqual('0765000000000000000000000000000000000000', res);
			test.done();
		},
		
		"should get diametrically opposite point for halfway value" : function(test) {			
			var res = id.getDiametricOpposite('8000000000000000000000000000000000000000');
			
			test.strictEqual('0000000000000000000000000000000000000000', res);
			test.done();
		}
	})
};
