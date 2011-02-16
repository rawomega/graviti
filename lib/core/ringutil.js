//
// Provides utility functions for calculating ring positions,
// nearest id from a set, routing hops etc.
//
var util = require ('util');
var bigint = require('thirdparty/bigint');
var langutil = require ('common/langutil');
var id = require('common/id');

var maxId = undefined;

module.exports = {
	//
	// Return id from the list of ids that is nearest to the required id.
	// Also return max and min ids found. By default, allow wrapping so that
	// 000...001 is very near FFF...FFE. This can be suppressed by setting
	// wrap to false
	getNearestId : function(id, ids, wrap) {
		if (!ids)
			ids = [];
		
		if (!langutil.isArray(ids)) {
			ids = Object.keys(ids);
		}
		
		if (wrap === undefined)
			wrap = true;
				
		var bigId = bigint.str2bigInt(id, 16);	

		var bestId = undefined;
		var bestDist = this.getMaxId();
		var bigHighest = undefined;
		var bigLowest = undefined;		
		var highest = undefined;
		var lowest = undefined;
		for (var idx in ids) {
			var currId = ids[idx];
			var bigCurr = bigint.str2bigInt(currId, 16);
			if (!bigHighest || bigint.greater(bigCurr, bigHighest)) {
				bigHighest = bigCurr;
				highest = currId;
			}
			if (!bigLowest || bigint.greater(bigLowest, bigCurr)) {
				bigLowest = bigCurr;
				lowest = currId;
			}

			var isIdGreater = bigint.greater(bigId,bigCurr);
			var bigger = isIdGreater ? bigId : bigCurr;
			var smaller= isIdGreater ? bigCurr : bigId;
			
			var distCCW = bigint.sub(bigger,smaller);
			var distCW= bigint.sub(bigint.add(this.getMaxId(), smaller), bigger);
			
			// if dist is same as current best dist, we pick current id as best only if it is clockwise
			if (bigint.equals(distCCW, bestDist) && !isIdGreater) {
				bestDist = distCCW;
				bestId = currId;
			} else if (wrap && bigint.equals(distCW, bestDist) && isIdGreater) {
				bestDist = distCW;
				bestId = currId;
			} else if (wrap && bigint.greater(bestDist, distCW) && bigint.greater(distCCW, distCW)) {
				bestDist = distCW;
				bestId = currId;
			} else if (bigint.greater(bestDist, distCCW) && (!wrap || bigint.greater(distCW, distCCW))) {
				bestDist = distCCW;
				bestId = currId; 
			} 
		}
		return {
			nearest : bestId,
			highest : highest,
			highestBigint : bigHighest,
			lowest : lowest,
			lowestBigint : bigLowest
		};
	},
	
	//
	// get min and max ids in the leafset
	getHighestAndLowestIds : function(ids) {
		if (!langutil.isArray(ids)) {
			ids = Object.keys(ids);
		}
		
		var highestBigint = undefined;
		var lowestBigint = undefined;
		var highest = undefined;
		var lowest = undefined;
		for (var idx in ids) {
			var curr = ids[idx];
			var currBigint = bigint.str2bigInt(curr, 16);
			if (!highest || bigint.greater(currBigint, highestBigint)) {
				highestBigint = currBigint;
				highest = curr;				
			}
			if (!lowest || bigint.greater(highestBigint, currBigint)) {
				lowestBigint = currBigint;
				lowest = curr;				
			}
		}
		return {
			highest : highest,
			lowest : lowest
		};
	},
	
	//
	// return max id value as a bigint
	getMaxId : function() {
		if (maxId)
			return maxId;
		
		var maxIdStr = '';
		for (var i = 0; i < (id.lengthBits / 4); i++) {
			maxIdStr = maxIdStr + 'F';			
		}
		
		maxId = bigint.str2bigInt(maxIdStr, 16);
		return maxId;
	},

	//
	// figure out if this node is nearest to the given id in id-space
	amINearest : function(theId, myId, leafset) {
		if (!leafset)
			return true;
		
		if (!langutil.isArray(leafset)) {
			leafset = Object.keys(leafset);
		}
		
		if (theId) {
			var nearestId = this.getNearestId(theId, leafset.concat([myId])).nearest;			
			if (nearestId && nearestId !== myId)
				return false;
		}
		return true; 
	}
};