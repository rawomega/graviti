var uuid = require('node-uuid');
var bigint = require('thirdparty/bigint');
var langutil = require ('langutil');
var crypto = require('crypto');

var highestPossibleId = undefined; // calculated lazily below
var halfwayPoint = undefined; // calculated lazily below

exports.lengthBits = 160;

exports.parseUri = function(uri) {
	if (uri.indexOf('p2p:') !== 0)
		throw new Error('Invalid or missing uri scheme: ' + uri);
	var parts = uri.split('/');
	if (parts.length < 2)
		throw new Error('Missing resource (/...) in uri ' + uri);
	var scheme = parts[0].substring(0, parts[0].indexOf(':'));
	var appName = parts[0].substring(1+parts[0].indexOf(':'));
	if (appName.length < 1)
		throw new Error('Missing id in uri ' + uri);
	
	var resource = uri.substring(uri.indexOf('/'));
	var hash = crypto.createHash('sha1').update(resource).digest('hex').toUpperCase();
	return {
		scheme: scheme,
		app_name: appName.toLowerCase(),
		resource: resource.toLowerCase(),
		hash: hash
	};
};

exports.generateNodeId = function() {
	var first = uuid().replace(/-/g, '');
	var second = uuid().replace(/-/g, '');
	return (first + second).substring(0, 40);
};

exports.generateUuid = function() {
	return uuid().toUpperCase();
};

//
// return an abbreviated version of an id as string
exports.idAsShortString = function(id) {
	if (!id)
		return undefined;
	return id.substring(0, 3) + '..' + id.substr(id.length - 3);
};

exports.id2Bigint = function(id) {
	return bigint.str2bigInt(id, 16);
};

//
// convert bigints to id strings with correct zero padding
exports.bigint2Id = function(n) {
	var unpadded = bigint.bigInt2str(n, 16);
	var padded = unpadded;
	if (unpadded.length < this.lengthBits / 4) {
		for ( var i = 0; i < (this.lengthBits / 4 - unpadded.length); i++) {
			padded = '0' + padded;
		}
	}
	return padded;
};

//
// return max id value as a bigint
exports.getHighestPossibleIdAsBigint = function() {
	if (this.highestPossibleId)
		return this.highestPossibleId;

	var maxIdStr = '';
	for ( var i = 0; i < (this.lengthBits / 4); i++) {
		maxIdStr = maxIdStr + 'F';
	}

	this.highestPossibleId = bigint.str2bigInt(maxIdStr, 16);
	return this.highestPossibleId;
};

//
// return number of ids in ring
exports.getIdSpaceSizeAsBigint = function() {
	if (this.idSpaceSize)
		return this.idSpaceSize;

	var idSpaceSizeStr = '1';
	for ( var i = 0; i < (this.lengthBits / 4); i++) {
		idSpaceSizeStr = idSpaceSizeStr + '0';
	}

	this.idSpaceSize = bigint.str2bigInt(idSpaceSizeStr, 16);
	return this.idSpaceSize;
};

//
// return halfway point on ring, useful when calculating diametric opposites for
// instance
exports.getHalfwayPointAsBigint = function() {
	var halfwayIdStr = '8';
	for ( var i = 0; i < (this.lengthBits / 4) - 1; i++) {
		halfwayIdStr = halfwayIdStr + '0';
	}

	this.halfwayPoint = bigint.str2bigInt(halfwayIdStr, 16);
	return this.halfwayPoint;
};

exports.getCommonPrefixLength = function(id1, id2) {
	if (id1 === undefined || id2 === undefined)
		return 0;

	id1 = id1.toUpperCase();
	id2 = id2.toUpperCase();
	for ( var i = 0; i < Math.min(id1.length, id2.length); i++) {
		if (id1.charAt(i) != id2.charAt(i))
			return i;
	}
	return i;
};

exports.getDiametricallyOppositeId = function(id) {
	var bigId = bigint.str2bigInt(id, 16);
	var halfwayId = this.getHalfwayPointAsBigint();

	var res;
	if (bigint.greater(halfwayId, bigId)) {
		res = bigint.add(halfwayId, bigId);
	} else {
		res = bigint.sub(bigId, halfwayId);
	}
	return this.bigint2Id(res);
};

//
// Return id from the list of ids that is nearest to the required id.
// Also return max and min ids found. By default, allow wrapping so that
// 000...001 is very near FFF...FFE. This can be suppressed by setting
// wrap to false
exports.getNearestId = function(id, ids, wrap) {
	if (!ids)
		ids = [];

	if (!langutil.isArray(ids)) {
		ids = Object.keys(ids);
	}

	// validate lengths so we NEVER AGAIN have to debug bad results from this func due
	// to typos :)
	if (id.length !== exports.lengthBits / 4)
		throw new Error('Invalid id length: ' + id.length + ' - id ' + id);
	ids.forEach(function(i) {		
		if (i.length !== exports.lengthBits / 4)
			throw new Error('Invalid id length: ' + i.length + ' - id ' + i);
	});

	if (wrap === undefined)
		wrap = true;

	var bigId = bigint.str2bigInt(id, 16);

	var bestId = undefined;
	var bestDist = exports.getIdSpaceSizeAsBigint();
	var bigHighest = undefined;
	var bigLowest = undefined;
	var highest = undefined;
	var lowest = undefined;
	for ( var idx in ids) {
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

		var isIdGreater = bigint.greater(bigId, bigCurr);
		var bigger = isIdGreater ? bigId : bigCurr;
		var smaller = isIdGreater ? bigCurr : bigId;

		var distCCW = bigint.sub(bigger, smaller);
		var distCW = bigint.sub(bigint.add(exports.getIdSpaceSizeAsBigint(),
				smaller), bigger);

		// if dist is same as current best dist, we pick current id as best only
		// if it is clockwise
		if (bigint.equals(distCCW, bestDist) && !isIdGreater) {
			bestDist = distCCW;
			bestId = currId;
		} else if (wrap && bigint.equals(distCW, bestDist) && isIdGreater) {
			bestDist = distCW;
			bestId = currId;
		} else if (wrap && bigint.greater(bestDist, distCW)
				&& (bigint.greater(distCCW, distCW))) {
			bestDist = distCW;
			bestId = currId;
		} else if (bigint.greater(bestDist, distCCW)
				&& (!wrap || bigint.greater(distCW, distCCW))) {
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
};

exports.getFurthestId = function(id, ids, wrap) {
	var oppositeId = exports.getDiametricallyOppositeId(id);
	return exports.getNearestId(oppositeId, ids, wrap).nearest;
};

//		
//
// figure out if this node is nearest to the given id in id-space
exports.amINearest = function(theId, myId, leafset) {
	if (!leafset)
		return true;

	if (!langutil.isArray(leafset)) {
		leafset = Object.keys(leafset);
	}

	if (theId) {
		var nearestId = this.getNearestId(theId, leafset.concat( [ myId ])).nearest;
		if (nearestId && nearestId !== myId)
			return false;
	}
	return true;
};

//
// given a set of ids, returns them in order of increasing distance from ref id,
// either cw or ccw depending on argument
exports.sortByIncreasingDistance = function(id, origIds, sortClockwise) {
	if (sortClockwise === undefined)
		sortClockwise = true;

	var ids = [];
	var bigId = bigint.str2bigInt(id, 16);
	origIds.forEach(function(currId) {
		var bigCurrId = bigint.str2bigInt(currId, 16);
		var isIdGreater = bigint.greater(bigId, bigCurrId);
		var distCcw = isIdGreater ? bigint.sub(bigId, bigCurrId) : bigint.sub(
				exports.getIdSpaceSizeAsBigint(), bigint.sub(bigCurrId, bigId));
		var distCw = bigint.sub(exports.getIdSpaceSizeAsBigint(), distCcw);

		ids.push( {
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
};
