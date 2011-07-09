var uuid = require('node-uuid');
var buffertools = require('buffertools');
var bigint = require('thirdparty/bigint');

var self = module.exports = {
	lengthBits : 160,
	highestPossibleId : undefined,	// calculated lazily below
	halfwayPoint : undefined,	// calculated lazily below
	
	generateNodeId : function() {
		var first = uuid().replace(/-/g, '');
		var second= uuid().replace(/-/g, '');
		return (first + second).substring(0,40);
	},
	
	generateUuid : function() {
		return uuid().toUpperCase();
	},
	
	id2Bigint : function(id) {
		return bigint.str2bigInt(id, 16);
	},

	//
	// return an abbreviated version of an id as string
	abbr : function(id) {
		if (!id)
			return undefined;
		return id.substring(0,3) + '..' + id.substr(id.length-3);
	},
	
	//
	// convert bigints to id strings with correct zero padding
	bigint2Id : function(n) {
		var unpadded = bigint.bigInt2str(n, 16);
		var padded = unpadded;
		if (unpadded.length < self.lengthBits / 4) {
			for (var i = 0; i < (self.lengthBits / 4 - unpadded.length); i++) {
				padded = '0' + padded;
			}
		}
		return padded;
	},

	//
	// return max id value as a bigint
	getHighestPossibleIdAsBigint : function() {
		if (self.highestPossibleId)
			return self.highestPossibleId;
		
		var maxIdStr = '';
		for (var i = 0; i < (self.lengthBits / 4); i++) {
			maxIdStr = maxIdStr + 'F';			
		}
		
		self.highestPossibleId = bigint.str2bigInt(maxIdStr, 16);
		return self.highestPossibleId;
	},

	//
	// return number of ids in ring
	getIdSpaceSizeAsBigint : function() {
		if (self.idSpaceSize)
			return self.idSpaceSize;
		
		var idSpaceSizeStr = '1';
		for (var i = 0; i < (self.lengthBits / 4); i++) {
			idSpaceSizeStr = idSpaceSizeStr + '0';			
		}
		
		self.idSpaceSize = bigint.str2bigInt(idSpaceSizeStr, 16);
		return self.idSpaceSize;
	},

	//
	// return halfway point on ring, useful when calculating diametric opposites for instance
	getHalfwayPointAsBigint : function() {
		var halfwayIdStr = '8';
		for (var i = 0; i < (self.lengthBits / 4) - 1; i++) {
			halfwayIdStr = halfwayIdStr + '0';			
		}
		
		self.halfwayPoint = bigint.str2bigInt(halfwayIdStr, 16);
		return self.halfwayPoint;
	},
	
	getCommonPrefixLength : function(id1, id2) {
		if (id1 === undefined || id2 === undefined)
			return 0;
		
		id1 = id1.toUpperCase();
		id2 = id2.toUpperCase();
		for (var i = 0; i < Math.min(id1.length, id2.length); i++) {
			if (id1.charAt(i) != id2.charAt(i))
				return i;
		}
		return i;
	},
	
	getDiametricOpposite : function(id) {
		var bigId = bigint.str2bigInt(id, 16);
		var halfwayId = self.getHalfwayPointAsBigint();
		
		var res;
		if (bigint.greater(halfwayId, bigId)) {
			res = bigint.add(halfwayId, bigId);
		} else {
			res = bigint.sub(bigId, halfwayId);
		}
		return self.bigint2Id(res);
	}
};
