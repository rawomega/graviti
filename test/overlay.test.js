var overlay = require('overlay');
var assert = require('assert');
var sinon = require('sinon');

module.exports = {
	shouldJustStartNodeWhenStartingNewRing : function() {
		// setup
		var mocknode = sinon.mock(require('node'));
		mocknode.expects('start').withArgs(1234, "127.0.0.1");
		
		// act
		overlay.init(1234, "127.0.0.1");

		// assert
		mocknode.verify();
	},

// todo: move these to bootstrapper
/*	
	shouldFailToStartWhenBootstrapListMissing : function() {
		assert.throws(function() {
		            overlay.join(123, 'abc');
		    }, /bootstrap list/
		);
	},
	
	shouldFailToStartWhenBootstrapListEmpty : function() {
		assert.throws(function() {
		            overlay.join(123, 'abc', '');
		    }, /bootstrap list/
		);
	},
*/	

	shouldStartAndInitiateBootstrapsOnJoiningAnExistingRing : function() {
		// setup
		var mocknode = sinon.mock(require('node'));
		mocknode.expects('start').withArgs(1234, "127.0.0.1");

		// act
		overlay.join(1234, "127.0.0.1", '127.0.0.1:4567');
		
		// assert
		mocknode.verify();
	},

	shouldStopNodeOnLeavingRing : function() {	
		// setup
		var mocknode = sinon.mock(require('node'));
		mocknode.expects('stop');

		// act
		overlay.leave();
		
		// assert
		mocknode.verify();
	}
};