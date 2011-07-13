var sinon = require('sinon');
var node = require('core/node');
var testCase = require('nodeunit').testCase;

module.exports = {		
	"initialising node id" : testCase({
		"should initialise node id when blank" : function(test) {
			node.init();
	
			test.ok(/[0-9A-F]{40}/i.test(node.nodeId));
			test.done();
		},
		
		"should not initialise node id when not blank" : function(test) {
			node.nodeId = "aaa";
			
			node.init();
	
			test.strictEqual("aaa", node.nodeId);
			test.done();
		},
	}),
	
	"setting node id" : testCase({
		"should set node id to given value" : function(test) {
			node.set("abc");
	
			test.strictEqual("abc", node.nodeId);
			test.done();
		},
	})
}