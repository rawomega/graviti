var ringutil = require('ringutil');
var assert = require('assert');

var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';

module.exports = {
	shouldFindNoNearestIdWhenIdSetUndefined: function() {
		assert.eql(undefined, ringutil.getNearestId(anId, undefined));
	},
	
	shouldFindNoNearestIdWhenIdSetEmpty : function() {
		assert.eql(undefined, ringutil.getNearestId(anId, []));
	},
	
	shouldFindNoNearestIdWhenIdSetContainsSelf : function() {
		assert.eql(anId, ringutil.getNearestId(anId, [anId]));
	},
	
	shouldFindNoNearestIdWhenIdSetContainsHigherId  : function() {
		assert.eql(higherId, ringutil.getNearestId(anId, [higherId]));
	},
	
	shouldFindNoNearestIdWhenIdSetContainsLowerId  : function() {
		assert.eql(lowerId, ringutil.getNearestId(anId, [lowerId]));
	},
	
	shouldFindNoNearestIdWhenItIsWrappedCW : function() {
		assert.eql(wrappedId, ringutil.getNearestId(anId, [lowerId, wrappedId]));
	},
	
	shouldFindNoNearestIdFromThree : function() {
		assert.eql(higherId, ringutil.getNearestId(anId, [lowerId, higherId, wrappedId]));
	},
	
	shouldGiveNearestIdClockwiseWhenSameDistance : function() {
		var lowerFirst = ringutil.getNearestId(anId, [oneLessId, oneMoreId]);
		var higherFirst = ringutil.getNearestId(anId, [oneMoreId, oneLessId]);
		
		assert.eql(oneMoreId, lowerFirst);
		assert.eql(oneMoreId, higherFirst);
	},
	
	shouldBeAbleToGetNearestIdOrSelfWhenNoIdsGiven : function() {
		assert.eql(anId, ringutil.getNearestIdOrSelf(anId, undefined));
	},
	
	shouldBeAbleToGetNearestIdOrSelfWhenIdsGiven : function() {
		assert.eql(higherId, ringutil.getNearestIdOrSelf(anId, [higherId, lowerId]));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenNoLeafset : function() {
		assert.eql(true, ringutil.isForMe(higherId, anId, undefined));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetEmpty : function() {
		assert.eql(true, ringutil.isForMe(higherId, anId, []));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetContainsOwnId: function() {
		assert.eql(true, ringutil.isForMe(higherId, anId, [anId]));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetContainsFurtherId: function() {
		assert.eql(true, ringutil.isForMe(higherId, anId, [lowerId]));
	},
	
	shouldDetermineIfGivenIdIsNearestToOwnIdThanAnyLeafsetIdsWhenLeafsetContainsNearerId: function() {
		assert.eql(false, ringutil.isForMe(higherId, anId, [oneMoreId, lowerId]));
	}
};