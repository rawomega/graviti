//
// Provides utility functions for calculating ring positions,
// nearest id from a set, routing hops etc.
//
var bigint = require('thirdparty/bigint');
var langutil = require ('common/langutil');
var mod_id = require('common/id');

var self = module.exports = {
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
		
		// validate lengths so we NEVER have to debug bad results from this func due to typos :)
		if (id.length !== mod_id.lengthBits / 4)
			throw new Error('Invalid id length: ' + id.length + ' - id ' + id);
		ids.forEach(function(i) {
			if (i.length !== mod_id.lengthBits / 4)
				throw new Error('Invalid id length: ' + i.length + ' - id ' + i);
		});

		if (wrap === undefined)
			wrap = true;
				
		var bigId = bigint.str2bigInt(id, 16);	

		var bestId = undefined;
		var bestDist = mod_id.getIdSpaceSizeAsBigint();
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
			var distCW= bigint.sub(bigint.add(mod_id.getIdSpaceSizeAsBigint(), smaller), bigger);
			
			// if dist is same as current best dist, we pick current id as best only if it is clockwise
			if (bigint.equals(distCCW, bestDist) && !isIdGreater) {
				bestDist = distCCW;
				bestId = currId;
			} else if (wrap && bigint.equals(distCW, bestDist) && isIdGreater) {
				bestDist = distCW;
				bestId = currId;
			} else if (wrap && bigint.greater(bestDist, distCW) && (bigint.greater(distCCW, distCW))) {
				bestDist = distCW;
				bestId = currId;
			} else if (bigint.greater(bestDist, distCCW) && (!wrap || bigint.greater(distCW, distCCW))) {
				bestDist = distCCW;
				bestId = currId; 
			} 
		}
		var res = {
				nearest : bestId,
				highest : highest,
				highestBigint : bigHighest,
				lowest : lowest,
				lowestBigint : bigLowest
			};		
		return res;
	},
	
	getFurthestId : function(id, ids, wrap) {
		var oppositeId = mod_id.getDiametricOpposite(id);
		return self.getNearestId(oppositeId, ids, wrap).nearest;
	},
	
//	//
//	// get min and max ids in the leafset
//	getHighestAndLowestIds : function(ids) {
//		if (!langutil.isArray(ids)) {
//			ids = Object.keys(ids);
//		}
//		
//		var highestBigint = undefined;
//		var lowestBigint = undefined;
//		var highest = undefined;
//		var lowest = undefined;
//		for (var idx in ids) {
//			var curr = ids[idx];
//			var currBigint = bigint.str2bigInt(curr, 16);
//			if (!highest || bigint.greater(currBigint, highestBigint)) {
//				highestBigint = currBigint;
//				highest = curr;
//			}
//			if (!lowest || bigint.greater(lowestBigint, currBigint)) { 	
//				lowestBigint = currBigint;
//				lowest = curr;				
//			}
//		}
//		return {
//			highest : highest,
//			lowest : lowest,
//			highestBigint : highestBigint,
//			lowestBigint : lowestBigint
//		};
//	},

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
	},
	
	//
	// given a set of ids, returns them in order of increasing distance from ref id,
	// either cw or ccw depending on argument
	sortByIncreasingDistance : function(id, origIds, sortClockwise) {
		if (sortClockwise === undefined)
			sortClockwise = true;
		
		var ids = [];
		var bigId = bigint.str2bigInt(id, 16);		
		origIds.forEach(function(currId) {
			var bigCurrId = bigint.str2bigInt(currId, 16);
			var isIdGreater = bigint.greater(bigId,bigCurrId);		
			var distCcw = isIdGreater ? bigint.sub(bigId, bigCurrId)
					: bigint.sub(mod_id.getIdSpaceSizeAsBigint(), bigint.sub(bigCurrId, bigId));
			var distCw = bigint.sub(mod_id.getIdSpaceSizeAsBigint(), distCcw);
			
			ids.push({
				id : currId,
				big_id : bigCurrId, 
				dist_cw : distCw,
				dist_ccw : distCcw 
			});
		});
		
		ids.sort(function(a, b) {
			if (bigint.equals(a.dist_cw, b.dist_cw))
				return 0;
			
			var cwGreater = bigint.greater(a.dist_cw, b.dist_cw);			
			return (sortClockwise ? 1 : -1) * (cwGreater ? 1 : -1);
		});
		
		var res = [];
		ids.forEach(function(currId) {
			if (res.indexOf(currId.id) < 0)
				res.push(currId.id);
		});
		return res;
	}
};