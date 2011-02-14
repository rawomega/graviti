var overlay = require('../../lib/core/overlay');
var assert = require('assert');
var sinon = require('sinon');
var testCase = require('nodeunit').testCase;

module.exports = {
	"initiating a new overlay" : testCase({		
		"should start node when starting new ring" : function(test) {
			// setup
			var mocknode = sinon.mock(require('../../lib/core/node'));
			mocknode.expects('start').withArgs(1234, "127.0.0.1");
			
			// act
			overlay.init(1234, "127.0.0.1");
	
			// assert
			mocknode.verify();
			test.done();
		}
	}),

 	"joining an existing ring" : testCase({		
		"should start node and initiate bootstrapping when joining an existing ring" : function(test) {
			// setup
			var mocknode = sinon.mock(require('../../lib/core/node'));
			mocknode.expects('start').withArgs(1234, "127.0.0.1");
	
			// act
			overlay.join(1234, "127.0.0.1", '127.0.0.1:4567');
			
			// assert
			mocknode.verify();
			test.done();
		}
	}),
	
	"leaving a ring" : testCase({
		"should stop node when leaving ring" : function(test) {	
			// setup
			var mocknode = sinon.mock(require('../../lib/core/node'));
			mocknode.expects('stop');
	
			// act
			overlay.leave();
			
			// assert
			mocknode.verify();
			test.done();
		}
	})
};