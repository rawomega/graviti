var assert = require('assert');
var routingmgr = require('../lib/routingmgr');
var testCase = require('nodeunit').testCase;
var node = require('../lib/node');

var anId = 'F45A18416DD849ACAA55D926C2D7946064A69EF2';
var higherId = 'F7DB7ACE15254C87B81D05DA8FA49588540B1950';
var lowerId = '65B658373C7841A7B66521637C25069758B46189';
var wrappedId = '0F5147A002B4482EB6D912E3E6518F5CC80EBEE6';
var oneMoreId = 'F45A18416DD849ACAA55D926C2D7946064A69EF3';
var oneLessId = 'F45A18416DD849ACAA55D926C2D7946064A69EF1';
var nearEdgeId= 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE';
var overEdgeId= '0000000000000000000000000000000000000001';

module.exports = {
	"updating the routing table" : testCase({
		setUp : function(done) {
			routingmgr.routingTable = {};
			node.nodeId = anId;
			done();
		},
		
		"update routing table with nothing" : function(test) {
			routingmgr.updateRoutingTable(undefined);
			
			test.equal(0, Object.keys(routingmgr.routingTable).length);
			test.done();
		},
		
		"update empty routing table with an id with no bits in common" : function(test) {
			routingmgr.updateRoutingTable('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6');
			
			test.deepEqual({
				"0":{"0":'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"update empty routing table with an id with 1 bit in common" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
			
			test.deepEqual({
				"1":{"7":"F7DB7ACE15254C87B81D05DA8FA49588540B1950"}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"update empty routing table with the id equal to the node id" : function(test) {
			routingmgr.updateRoutingTable(anId);
			
			test.deepEqual({}, routingmgr.routingTable);
			test.done();
		}
	})
};