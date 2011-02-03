//
// Provides utility functions for calculating ring positions,
// nearest id from a set, routing hops etc.
//
var bigint = require('./thirdparty/bigint');

module.exports = {
	getNearestId : function(id, ids) {
		if (!ids || ids.length < 1)
			return undefined;
				
		var bigId = bigint.str2bigInt(id, 16);
		
		var best = undefined;
		for (var idx in ids) {
			var bigCurr = bigint.str2bigInt(ids[idx], 16);

			// do some more stuff
		}
		return best;
	},

	//
	// figure out if this message is for us
	isForMe : function(theId, myId, leafset) {
		if (theId) {
			var nearestNode = this.getNearestId(theId, leafset);
			if (nearestNode && nearestNode !== myId)
				return false;
		}
		return true; 
	}
};