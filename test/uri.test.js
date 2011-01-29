var mod_uri = require('uri');
var assert = require('assert');

module.exports = {
	shouldThrowOnNoScheme : function() {
		assert.throws(function() {
				mod_uri.parse('abcdef/myresource');
			}, /uri scheme/
		);
	},
	shouldThrowOnBadScheme : function() {
                assert.throws(function() {
                                mod_uri.parse('bogus:abcdef/myresource');
                        }, /uri scheme/
                );
        },
	shouldThrowOnNoResource : function() {
                assert.throws(function() {
                                mod_uri.parse('p2p:abcdef-noresource');
                        }, /resource/
                );
        },
	shouldThrowOnMissingAppName : function() {
                assert.throws(function() {
                                mod_uri.parse('p2p:/myresource');
                        }, /id/
                );
        },
	shouldParseCorrectly : function() {
		var parsed_uri = mod_uri.parse('p2p:myapp/documents/xyz');
		assert.eql('p2p', parsed_uri.scheme);
		assert.eql('myapp', parsed_uri.app_name);
		assert.eql('/documents/xyz', parsed_uri.resource);
		assert.eql('A097B13EA2C82D0C2C09DE186E048D1EFF2537D2', parsed_uri.hash);
	}
}
