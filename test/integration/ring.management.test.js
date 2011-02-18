var util = require('util');
var multinode = require('testability/multinode');

module.exports = {	
	"start and stop a multi-node ring" : multinode.testCase({
		node_ids : [
		    '0000000000000000000000000000000000000000',
		    '4444444444444444444444444444444444444444',
		    '8888888888888888888888888888888888888888',
		    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
		],

		"populate leafsets" : function(test) {
			var leafsetCheck = function() {
				return Object.keys(require('core/leafsetmgr').leafset).length;
			};

			multinode.waitUntilEqual( 3, leafsetCheck, 0, function(res, msg) {
				test.ok(res, msg);
				test.done();
			});
		},

		"something else" : function(test) {
			test.done();
		}
	})
};