var util = require('util');
var multinode = require('testability/multinode');
var nodeunit = require('nodeunit');

module.exports = {
	"start and stop a multi-node ring" : nodeunit.testCase({
		setUp : function(done) {
			this.nodeIds = [
			    '0000000000000000000000000000000000000000',
			    '4444444444444444444444444444444444444444',
			    '8888888888888888888888888888888888888888',
			    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
			];
			this.nodes = multinode.start({
				node_ids : this.nodeIds
			});
			done();
		},
		
		tearDown : function(done) {
			multinode.stop(this.nodes);
			done();
		},

		"populate leafsets" : function(test) {
			var _this = this;
			var getLeafsetSize = function() {
				return Object.keys(require('core/leafsetmgr').leafset).length;
			};
			var getLeafset = function() {
				return require('core/leafsetmgr').leafset;
			};
			this.nodes[0].waitUntilEqual(3, getLeafsetSize, test, function() {
				_this.nodes[3].eval(getLeafset, test, function(res) {
					test.equal(3, Object.keys(res).length);
					test.ok(res[_this.nodeIds[0]] !== undefined);
					test.ok(res[_this.nodeIds[1]] !== undefined);
					test.ok(res[_this.nodeIds[2]] !== undefined);
					test.done();
				});
			});
		},

		"something else" : function(test) {
			test.done();
		}
	})
};