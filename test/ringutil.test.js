var ringutil = require('ringutil');
var assert = require('assert');
var bigint = require('thirdparty/bigint');

var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';
var nearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE';
var overEdgeId= '0000000000000000000000000000000000000001';
var slightlyLessNearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC'; 

module.exports = {
	shouldFindNoNearestIdWhenIdSetUndefined: function() {
		assert.eql(undefined, ringutil.getNearestId(anId, undefined).nearest);
	},
	
	shouldFindNoNearestIdWhenIdSetEmpty : function() {
		assert.eql(undefined, ringutil.getNearestId(anId, []).nearest);
	},
	
	shouldFindNearestIdWhenIdSetContainsSelf : function() {
		var res = ringutil.getNearestId(anId, [anId]);
		
		assert.eql(anId, res.nearest);
		assert.eql(anId, res.highest);
		assert.eql(anId, res.lowest);
	},
	
	shouldFindNearestIdWhenIdSetContainsHigherId  : function() {
		var res = ringutil.getNearestId(anId, [higherId]);
		
		assert.eql(higherId, res.nearest);
		assert.eql(higherId, res.highest);
		assert.eql(higherId, res.lowest);
	},
	
	shouldFindNearestIdWhenIdSetContainsLowerId  : function() {
		var res = ringutil.getNearestId(anId, [lowerId]);
		
		assert.eql(lowerId, res.nearest);
		assert.eql(lowerId, res.highest);
		assert.eql(lowerId, res.lowest);
	},
	
	shouldFindNearestIdWhenItIsWrappedCW : function() {
		var res = ringutil.getNearestId(anId, [lowerId, wrappedId]);
		
		assert.eql(wrappedId, res.nearest);
		assert.eql(lowerId, res.highest);
		assert.eql(wrappedId, res.lowest);
	},
	
	shouldFindNearestIdWhenWrappingNotAllowed : function() {
		var res = ringutil.getNearestId(anId, [lowerId, wrappedId], false);
		
		assert.eql(lowerId, res.nearest);
		assert.eql(lowerId, res.highest);
		assert.eql(wrappedId, res.lowest);
	},
	
	shouldFindNearestIdFromThree : function() {
		var res = ringutil.getNearestId(anId, [lowerId, higherId, wrappedId]);
		
		assert.eql(higherId, res.nearest);
		assert.eql(higherId, res.highest);
		assert.eql(wrappedId, res.lowest);
	},
	
	shouldFindNearestIdFromThreeWithoutWrapping : function() {
		var res = ringutil.getNearestId(anId, [lowerId, higherId, wrappedId], false);
		
		assert.eql(higherId, res.nearest);
		assert.eql(higherId, res.highest);
		assert.eql(wrappedId, res.lowest);
	},
	
	shouldFindNearestIdFromAnotherThreeWhereNearestIdIsWrapped : function() {
		var res = ringutil.getNearestId(lowerId, [oneLessId, higherId, wrappedId]);
		
		assert.eql(wrappedId, res.nearest);
		assert.eql(higherId, res.highest);
		assert.eql(wrappedId, res.lowest);
	},
	
	shouldFindNearestIdFromAnotherThreeWhereWrappingIsIgnored: function() {
		var res = ringutil.getNearestId(lowerId, [oneLessId, higherId, wrappedId], false);
		
		assert.eql(wrappedId, res.nearest);
		assert.eql(higherId, res.highest);
		assert.eql(wrappedId, res.lowest);
	},
	
	shouldGiveNearestIdClockwiseWhenSameDistance : function() {
		var resLowerFirst = ringutil.getNearestId(anId, [oneLessId, oneMoreId]);
		var resHigherFirst = ringutil.getNearestId(anId, [oneMoreId, oneLessId]);
		
		assert.eql(oneMoreId, resLowerFirst.nearest);
		assert.eql(oneMoreId, resHigherFirst.nearest);
	},
	
	shouldGiveNearestIdClockwiseWhenSameDistanceWithWraparound : function() {
		var resLowerFirst = ringutil.getNearestId(nearEdgeId, [slightlyLessNearEdgeId, overEdgeId]);
		var resHigherFirst = ringutil.getNearestId(nearEdgeId, [overEdgeId, slightlyLessNearEdgeId]);
		
		assert.eql(overEdgeId, resLowerFirst.nearest);
		assert.eql(overEdgeId, resHigherFirst.nearest);
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenNoLeafset : function() {
		assert.eql(true, ringutil.amINearest(higherId, anId, undefined));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetEmpty : function() {
		assert.eql(true, ringutil.amINearest(higherId, anId, {}));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetContainsOwnId: function() {
		assert.eql(true, ringutil.amINearest(higherId, anId, {anId : '1.2.3.4:1234'}));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetContainsFurtherId: function() {
		assert.eql(true, ringutil.amINearest(higherId, anId, {lowerId : '5.6.7.8:5678'}));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetContainsNearerId: function() {
		assert.eql(false, ringutil.amINearest(higherId, anId, [oneMoreId, lowerId]));
	}
};