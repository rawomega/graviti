var pnsrunner = require('core/pnsrunner');
var pns = require('core/pns');
var testCase = require('nodeunit').testCase;
var sinon = require('sinon');
var node = require('core/node');

module.exports = {
	"lifecycle events aka initialisation and cancellation" : testCase({
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should delegate initialisation to pns" : function(test) {
			var pnsInit = sinon.collection.stub(pns, 'init');
			var arg = sinon.stub();
			
			pnsrunner.init(arg);
			
			test.ok(pnsInit.calledWith(arg));
			test.done();
		},
		
		"should delegate cancellation to pns" : function(test) {
			var pnsCancelAll = sinon.collection.stub(pns, 'cancelAll');
			
			pnsrunner.cancelAll();
			
			test.ok(pnsCancelAll.called);
			test.done();
		}
	}),
	
	"running pns" : testCase({
		setUp : function(done) {
			node.nodeId = 'ABCDEF';
			var numCallbacks = 0;
			var _this = this;
			this.res = {
					id : 'A00' + numCallbacks,
					ap : '1.1.1.' + numCallbacks + ':1111',
					rtt: 100 * numCallbacks,
					discovered_peers : ['other', 'peers']
				};
			this.success = sinon.stub();
			this.pnsFind = sinon.collection.stub(pns, 'findNearestNode', function(seed, nodeId, success) {
				success(_this.res);
			});
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should initiate pns by starting the first pns run" : function(test) {
			pnsrunner.run('seed', this.success);
			
			test.ok(this.pnsFind.calledWith('seed', 'ABCDEF'));
			test.done();
		},
		
		"should do no more than max allowed num of finds in a pns run" : function(test) {
			pnsrunner.run('seed', this.success);
			
			test.equal(3, this.pnsFind.callCount);
			test.ok(this.success.calledWith('1.1.1.0:1111'));
			test.done();
		},
		
		"should only run once if no discovered peers" : function(test) {
			this.res.discovered_peers = [];
			
			pnsrunner.run('seed', this.success);
			
			test.equal(1, this.pnsFind.callCount);
			test.ok(this.success.calledWith('1.1.1.0:1111'));
			test.done();
		},
		
		"should only run once if discovered empty" : function(test) {
			this.res.discovered_peers = undefined;
			
			pnsrunner.run('seed', this.success);
			
			test.equal(1, this.pnsFind.callCount);
			test.ok(this.success.calledWith('1.1.1.0:1111'));
			test.done();
		},
		
		"should use up discovered peers only once" : function(test) {
			pnsrunner.run('seed', this.success);

			test.ok(this.pnsFind.calledWith('other', 'ABCDEF'));
			test.ok(this.pnsFind.calledWith('peers', 'ABCDEF'));	
			test.done();
		},
		
		"should randomize selection of seed from discovered peers from a prevoius run" : function(test) {
			this.res.discovered_peers = ['a', 'b', 'c'];
						
			while (!this.pnsFind.calledWith('a', 'ABCDEF') ||
					!this.pnsFind.calledWith('b', 'ABCDEF') ||
					!this.pnsFind.calledWith('c', 'ABCDEF'))
				pnsrunner.run('seed', this.success);
			
			test.done();
		}
	})	
}