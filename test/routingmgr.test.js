var assert = require('assert');
var routingmgr = require('../lib/routingmgr');
var testCase = require('nodeunit').testCase;
var node = require('../lib/node');
var sinon = require('sinon');
var leafsetmgr = require('../lib/leafsetmgr');

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
		},
		
		"update routing table having a single entry with a new entry with a different prefix" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
			
			routingmgr.updateRoutingTable('0F5147A002B4482EB6D912E3E6518F5CC80EBEE6');
			
			test.deepEqual({
				"0":{"0":'0F5147A002B4482EB6D912E3E6518F5CC80EBEE6'},
				"1":{"7":"F7DB7ACE15254C87B81D05DA8FA49588540B1950"}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"update routing table having a single entry with a new entry with a common prefix" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
			
			routingmgr.updateRoutingTable('F8D147A002B4482EB6D912E3E6518F5CC80EBEE6');
			
			test.deepEqual({
				"1":{"7":"F7DB7ACE15254C87B81D05DA8FA49588540B1950", "8":"F8D147A002B4482EB6D912E3E6518F5CC80EBEE6"}
			}, routingmgr.routingTable);
			test.done();
		},
		
		"routing table having a single entry does not get altered by a new entry with the same prefix" : function(test) {
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
			
			routingmgr.updateRoutingTable('F78147A002B4482EB6D912E3E6518F5CC80EBEE6');
			
			test.deepEqual({
				"1":{"7":"F7DB7ACE15254C87B81D05DA8FA49588540B1950"}
			}, routingmgr.routingTable);
			test.done();
		}
	}),
	
	"getting the next routing hop" : testCase({
		setUp : function(done) {
			routingmgr.routingTable = {};
			node.nodeId = anId;
			done();
		},
		
		"when we can route based on the leafset, just use that" : function(test) {
			leafsetmgr.getRoutingHop = sinon.stub().returns('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.equal('F7DB7ACE15254C87B81D05DA8FA49588540B1950', res);
			test.done();
		},
		
		"routing via empty routing table should return nothing" : function(test) {
			leafsetmgr.getRoutingHop = sinon.stub().returns(undefined);
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.equal(undefined, res);
			test.done();
		},
		
		"routing via routing table with exact match should return that match" : function(test) {
			leafsetmgr.getRoutingHop = sinon.stub().returns(undefined);
			routingmgr.updateRoutingTable('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
			
			var res = routingmgr.getNextHop('F7DB7ACE15254C87B81D05DA8FA49588540B1950');
		
			test.equal('F7DB7ACE15254C87B81D05DA8FA49588540B1950', res);
			test.done();
		},
		
		"routing to same id as node id should return nothing" : function(test) {
			var res = routingmgr.getNextHop(anId);
		
			test.equal(undefined, res);
			test.done();
		},
		
		"routing via routing table with irrelevant entry should return nothing" : function(test) {
			leafsetmgr.getRoutingHop = sinon.stub().returns(undefined);
			routingmgr.updateRoutingTable(  'F78147A002B4482EB6D912E3E6518F5CC80EBEE6');
			
			var res = routingmgr.getNextHop('355607ACE1254C87B81D05DA8FA49588540B1950');
		
			test.equal(undefined, res);
			test.done();
		}
	})
};