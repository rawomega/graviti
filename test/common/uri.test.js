var uri = require('../../lib/common/uri');
var assert = require('assert');
var testCase = require('nodeunit').testCase;

module.exports = {
	"uri parsing" : testCase({
		"should throw on no scheme" : function(test) {
			assert.throws(function() { uri.parse('abcdef/myresource'); }, /uri scheme/ );
			test.done();
		},
		
		"should throw on bad scheme" : function(test) {
			assert.throws(function() { uri.parse('bogus:abcdef/myresource'); }, /uri scheme/);
			test.done();
	    },
		
	    "should throw on no resource" : function(test) {
	    	assert.throws(function() {uri.parse('p2p:abcdef-noresource');}, /resource/);
	    	test.done();
	    },
		
	    "should throw on missing app name" : function(test) {
            assert.throws(function() {uri.parse('p2p:/myresource');}, /id/);
            test.done();
	    },
		
	    "should parse correctly" : function(test) {
			var parsedUri = uri.parse('p2p:myapp/documents/xyz');
			
			test.strictEqual('p2p', parsedUri.scheme);
			test.strictEqual('myapp', parsedUri.app_name);
			test.strictEqual('/documents/xyz', parsedUri.resource);
			test.strictEqual('A097B13EA2C82D0C2C09DE186E048D1EFF2537D2', parsedUri.hash);
			test.done();
		}
	})
};