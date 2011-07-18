var sinon = require('sinon');
var node = require('core/node');
var testCase = require('nodeunit').testCase;

module.exports = {
	"initialising node id" : testCase({
		setUp : function(done) {
			this.node = new node.Node();
			done();
		},
		
		"should initialise node id when blank" : function(test) {
			this.node.init();
	
			test.ok(/[0-9A-F]{40}/i.test(this.node.nodeId));
			test.done();
		},
		
		"should not initialise node id when not blank" : function(test) {
			this.node.nodeId = "aaa";
			
			this.node.init();
	
			test.strictEqual("aaa", this.node.nodeId);
			test.done();
		},
	}),
	
	"setting node id" : testCase({
		setUp : function(done) {
			this.node = new node.Node();
			done();
		},
		
		"should set node id to given value" : function(test) {
			this.node.set("abc");
	
			test.strictEqual("abc", this.node.nodeId);
			test.done();
		},
	})
}