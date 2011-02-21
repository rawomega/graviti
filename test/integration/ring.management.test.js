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

		"should populate leafsets after bootstrapping" : function(test) {
			var _this = this;
			var getLeafsetSize = function() {
				return Object.keys(require('core/leafsetmgr').leafset).length;
			};
			var getLeafset = function() {
				return require('core/leafsetmgr').leafset;
			};
			var getRoutingTable = function() {
				return require('core/routingmgr').routingTable;
			};
			
			// wait till leafset is sorted
			this.nodes[0].waitUntilEqual(3, getLeafsetSize, test, function() {
				
				// leafset populated
				_this.nodes[3].eval(getLeafset, test, function(res) {
					test.equal(3, Object.keys(res).length);
					test.ok(res[_this.nodeIds[0]] !== undefined);
					test.ok(res[_this.nodeIds[1]] !== undefined);
					test.ok(res[_this.nodeIds[2]] !== undefined);
					
					// routing table populated
					_this.nodes[3].eval(getRoutingTable, test, function(res) {
						test.equal(_this.nodeIds[0], res[0][0].id);
						test.equal(_this.nodeIds[1], res[0][4].id);
						test.equal(_this.nodeIds[2], res[0][8].id);
						test.done();
					});
				});
			});
		}
	})
};