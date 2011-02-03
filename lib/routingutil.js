//
// Provides utility functions for calculating ring positions,
// nearest id from a set, routing hops etc.
//

module.exports = {
	getNearestId : function(id, ids) {
		// todo: some magic
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