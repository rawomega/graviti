//
// Provides utility functions for calculating ring positions,
// nearest id from a set, routing hops etc.
//
var bigint = require('./thirdparty/bigint');
var idLengthBits = 160;
var maxId = undefined;

module.exports = {
	getNearestIdOrSelf : function(id, ids) {
		var nearestId = this.getNearestId(id, ids);
		return nearestId ? nearestId : id;
	},
	
	getNearestId : function(id, ids) {
		if (!ids || ids.length < 1)
			return undefined;
				
		var bigId = bigint.str2bigInt(id, 16);	

		var bestId = undefined;
		var bestDist = this.getMaxId();
		for (var idx in ids) {
			var currId = ids[idx];
			var bigCurr = bigint.str2bigInt(currId, 16);

			var isIdGreater = bigint.greater(bigId,bigCurr);
			var bigger = isIdGreater ? bigId : bigCurr;
			var smaller= isIdGreater ? bigCurr : bigId;
			
			var distCCW = bigint.sub(bigger,smaller);
			var distCW= bigint.sub(bigint.add(this.getMaxId(), smaller), bigger);
			
			// if dist is same as current best dist, we pick current id as best only if it is clockwise
			if (bigint.equals(distCCW, bestDist) && !isIdGreater) {
				bestDist = distCCW;
				bestId = currId;
			} else if (bigint.equals(distCW, bestDist) && isIdGreater) {
				bestDist = distCW;
				bestId = currId;
			} else if (bigint.greater(bestDist, distCW) && bigint.greater(distCCW, distCW)) {
				bestDist = distCW;
				bestId = currId;
			} else if (bigint.greater(bestDist, distCCW) && bigint.greater(distCW, distCCW)) {
				bestDist = distCCW;
				bestId = currId; 
			} 
		}
		return bestId;
	},
	
	//
	// return max id value as a bigint
	getMaxId : function() {
		if (maxId)
			return maxId;
		
		var maxIdStr = '';
		for (var i = 0; i < (idLengthBits / 4); i++) {
			maxIdStr = maxIdStr + 'F';			
		}
		
		maxId = bigint.str2bigInt(maxIdStr, 16);
		return maxId;
	},

	//
	// figure out if this message is for us
	isForMe : function(theId, myId, leafset) {
		if (!leafset)
			return true;
		
		if (typeof(leafset) === 'object') {
			leafset = Object.keys(leafset);
		}
		
		if (theId) {
			var nearestId = this.getNearestId(theId, leafset.concat([myId]));			
			if (nearestId && nearestId !== myId)
				return false;
		}
		return true; 
	}
};