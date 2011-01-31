var gently = global.GENTLY = new (require('gently'));
var assert = require('assert');
var overlay = require('overlay');

module.exports = {
	shouldJustStartNodeWhenStartingNewRing : function() {
		// setup
		gently.expect(gently.hijacked['./node'], 'start', function(port, addr) {
				assert.eql(1234, port);
				assert.eql("127.0.0.1", addr);
		});

		// act
		overlay.init(1234, "127.0.0.1");

		// assert
		gently.verify();
	},
	
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
	
	shouldStartAndInitiateBootstrapsOnJoiningAnExistingRing : function() {
		// setup
		gently.expect(gently.hijacked['./node'], 'start', function(port, bindAddr) {
				assert.eql(1234, port);
				assert.eql("127.0.0.1", bindAddr);
		});

		// act
		overlay.join(1234, "127.0.0.1", '127.0.0.1:4567');
		
		// assert
		gently.verify();
	},
	
	shouldStopNodeOnLeavingRing : function() {
		// setup
		gently.expect(gently.hijacked['./node'], 'stop');

		// act
		overlay.leave();
		
		// assert
		gently.verify();
	},
}
