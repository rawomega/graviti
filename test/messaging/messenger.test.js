var node = require('core/node');
var assert = require('assert');
var testCase = require('nodeunit').testCase;
var messenger = require('messaging/messenger');
var messages = require('messaging/messages');
var myId = 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234';
	
module.exports = {
	"parsing an ack" : testCase({
		"should recognise a valid ack" : function(test) {
			var res = messenger.parseAck('ACK 123');
			
			test.equal('123', res);
			test.done();
		},
		
		"should not parse ack with line break" : function(test) {
			var res = messenger.parseAck('ACK 123\n');
			
			test.equal(undefined, res);
			test.done();
		},
		
		"should not parse non-ack" : function(test) {
			var res = messenger.parseAck('BACK 123');
			
			test.equal(undefined, res);
			test.done();
		},
		
		"should not parse nothing" : function(test) {
			var res = messenger.parseAck(undefined);
			
			test.equal(undefined, res);
			test.done();
		}
	}),
	
	"parsing a message" : testCase({
		setUp : function(done) {
			node.nodeId = myId;
			this.content = {a : 'ay', b : 'bee'}; 
			done();
		}, 
		
		tearDown : function(done) {
			messages.maxMessageSize = 65535;
			done();
		},
		
		"should parse simple message with uri and method only" : function(test) {
			var str = 'GET p2p:myapp/myres\n\n';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.done();
		},
		
		"should parse simple message with uri, method and dest id" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'dest_id: AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB\n'
				+ '\n';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.strictEqual('AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB', msg.dest_id);
			test.done();
		},
		
		"should parse simple message with uri, method, content dest id" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'dest_id: AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB\n'
				+ 'content_length: 10\n'
				+ '\n'
				+ '{"a" : "0123456789"}';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.strictEqual('0123456789', msg.content.a);
			test.strictEqual('AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB', msg.dest_id);
			test.done();
		},
		
		"should parse a message with line breaks in conent" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'dest_id: AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB\n'
				+ 'content_length: 10\n'
				+ '\n'
					+ '{\n'
				+ '\n\n'
				+ '"a" : "0123456789"\n'
				+ '}\n\n';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('0123456789', msg.content.a);
			test.done();
		},
		
		"should parse message with variously misformatted but valid headers" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ '  dest_id:AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB   \n'
				+ 'my header name :  my header value   \n'
				+ ' content_length      :10\n'
				+ '\n'
				+ '{"ab" : 1}';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB', msg.dest_id);
			test.strictEqual('my header value', msg['my header name']);
			test.done();
		},
		
		"should parse out content_length field" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'content_length: 10\n'
				+ '\n'
				+ '{"ab" : 1}';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.ok(undefined === msg.content_length);
			test.done();
		},
		
		"should parse message with text content" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'content_length: 3\n'
				+ 'content_type: text/plain\n'
				+ '\n'
				+ '123';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.ok('text/plain' === msg.content_type);
			test.strictEqual('123', msg.content);
			test.done();
		},
		
		"should parse message with explicitly typed json content" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'content_length: 8\n'
				+ 'content_type: application/json\n'
				+ '\n'
				+ '{"a":123}';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.ok('application/json' === msg.content_type);
			test.strictEqual(123, msg.content.a);
			test.done();
		},
		
		"should throw on parsing if bad method" : function(test) {
			var str = 'BAD p2p:myapp/myres\n'
				+ '  dest_id:AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB   \n'
				+ 'my header name :  my header value   \n'
				+ ' content_length      :10\n'
				+ '\n';
			
			assert.throws(function() { messenger.parse(str); }, /unsupported method/i);
			test.done();
		},
		
		"should throw on parsing if missing uri" : function(test) {
			var str = 'GET \n'
				+ '  dest_id:AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB   \n'
				+ 'my header name :  my header value   \n'
				+ ' content_length      :10\n'
				+ '\n';
			
			assert.throws(function() { messenger.parse(str); }, /missing destination uri/i);
			test.done();
		},
		
		"should throw on parsing if header with no colon" : function(test) {
			var str = 'POST p2p:myapp/myres\n'
				+ 'my header name my header value   \n'
				+ '\n';
			
			assert.throws(function() { messenger.parse(str); }, /bad header/i);
			test.done();
		},
		
		"should throw on parsing if header with no name" : function(test) {
			var str = 'POST p2p:myapp/myres\n'
				+ ' : my header name my header value   \n'
				+ '\n';
			
			assert.throws(function() { messenger.parse(str); }, /bad header/i);
			test.done();
		},
		
		"should throw on parsing if header with no value" : function(test) {
			var str = 'POST p2p:myapp/myres\n'
				+ 'my header name my header value : \n'
				+ '\n';
			
			assert.throws(function() { messenger.parse(str); }, /bad header/i);
			test.done();
		},
		
		"should throw on parsing if headers not done" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'dest_id:AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB\n';
			
			assert.throws(function() { messenger.parse(str); }, /parse headers/i);
			test.done();
		},
		
		"should throw on parsing if no content" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'dest_id:AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB\n'
				+ ' content_length: 10\n'
				+ '\n';
			
			assert.throws(function() { messenger.parse(str); }, /expected content/i);
			test.done();
		},
		
		"should throw on parsing if partial content" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'dest_id:AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB\n'
				+ ' content_length: 10\n'
				+ '\n'
				+ '{a:1}';
			
			assert.throws(function() { messenger.parse(str); }, /expected content/i);
			test.done();
		},
		
		"should throw on parsing if json content invalid" : function(test) {
			var str = 'POST p2p:myapp/myres\n'
				+ 'content_type: application/json\n'
				+ 'content_length: 8\n'
				+ '\n'
				+ '{badjson';
			
			assert.throws(function() { messenger.parse(str); }, /parse json content/i);
			test.done();
		},
		
		"should throw on parsing if message size exceeded" : function(test) {
			var str = 'POST p2p:myapp/myres\n'
				+ '\n';
			messages.maxMessageSize = 5;
			
			assert.throws(function() { messenger.parse(str); }, /message size/i);
			test.done();
		}
	}),
	
	"parsing a partial message" : testCase({
		setUp : function(done) {
			node.nodeId = myId;
			this.content = {a : 'ay', b : 'bee'}; 
			done();
		},
		
		"should parse one-line partial message" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ '\n';
			
			var res = messenger.progressiveParse(str);
			
			test.strictEqual(undefined, res.unparsed_part);
			test.strictEqual(true, res.headers_processed);
			test.strictEqual('GET', res.method);
			test.strictEqual('p2p:myapp/myres', res.uri);
			test.deepEqual({}, res.headers);
			test.strictEqual(true, res.content_processed);
			test.done();		
		},
		
		"should parse partial message with a header" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'name: value\n'
				+ '\n';
			
			var res = messenger.progressiveParse(str);
			
			test.strictEqual(undefined, res.unparsed_part);
			test.strictEqual(true, res.headers_processed);
			test.strictEqual('GET', res.method);
			test.strictEqual('p2p:myapp/myres', res.uri);
			test.deepEqual({name : 'value'}, res.headers);
			test.strictEqual(true, res.content_processed);
			test.done();		
		},
		
		"should parse partial message with multiple headers" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'name: value\n'
				+ 'one: 1\n'
				+ 'moo: baah baah\n'
				+ '\n';
			
			var res = messenger.progressiveParse(str);
			
			test.strictEqual(undefined, res.unparsed_part);
			test.strictEqual(true, res.headers_processed);
			test.strictEqual('GET', res.method);
			test.strictEqual('p2p:myapp/myres', res.uri);
			test.deepEqual({name : 'value', one : '1', moo : 'baah baah'}, res.headers);
			test.strictEqual(true, res.content_processed);
			test.done();		
		},
		
		"should parse partial message with content" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'content_length: 4\n'
				+ '\n'
				+ '1234';
			
			var res = messenger.progressiveParse(str);
			
			test.strictEqual(undefined, res.unparsed_part);
			test.strictEqual(true, res.headers_processed);
			test.strictEqual('GET', res.method);
			test.strictEqual('p2p:myapp/myres', res.uri);
			test.deepEqual({}, res.headers);
			test.strictEqual(1234, res.content);
			test.strictEqual(true, res.content_processed);
			test.done();		
		},
		
		"should parse partial message with headers and content with line breaks" : function(test) {
			var str = 'GET p2p:myapp/myres\n'
				+ 'name: value\n'
				+ 'content_length: 5\n'
				+ 'content_type: text/plain\n'
				+ '\n'
				+ '1\n2\n3';
			
			var res = messenger.progressiveParse(str);
			
			test.strictEqual(undefined, res.unparsed_part);
			test.strictEqual(true, res.headers_processed);
			test.strictEqual('GET', res.method);
			test.strictEqual('p2p:myapp/myres', res.uri);
			test.deepEqual({name : 'value', content_type : 'text/plain'}, res.headers);
			test.strictEqual('1\n2\n3', res.content);
			test.strictEqual(true, res.content_processed);
			test.done();		
		},
		
		"should parse message with method + uri in 2 parts" : function(test) {
			var str1 = 'GE';
			var str2 = 'T p2p:myapp/myres\n'
				+ '\n';
			
			var res1 = messenger.progressiveParse(str1);
			var res2 = messenger.progressiveParse(str2, res1);
			
			test.strictEqual('GE', res1.unparsed_part);
			test.strictEqual(undefined, res2.unparsed_part);
			test.strictEqual(false, res1.headers_processed);
			test.strictEqual(true, res2.headers_processed);
			test.strictEqual(undefined, res1.method);
			test.strictEqual('GET', res2.method);
			test.strictEqual(undefined, res1.uri);
			test.strictEqual('p2p:myapp/myres', res2.uri);
			test.deepEqual({}, res1.headers);
			test.deepEqual({}, res2.headers);
			test.strictEqual(false, res1.content_processed);
			test.strictEqual(true, res2.content_processed);
			test.done();		
		},
		
		"should parse message with method + uri in 2 parts, broken up at line break" : function(test) {
			var str1 = 'GET p2p:myapp/myres\n'
			var str2 = '\n';
			
			var res1 = messenger.progressiveParse(str1);
			var res2 = messenger.progressiveParse(str2, res1);
			
			test.strictEqual(undefined, res1.unparsed_part);
			test.strictEqual(undefined, res2.unparsed_part);
			test.strictEqual(false, res1.headers_processed);
			test.strictEqual(true, res2.headers_processed);
			test.strictEqual('GET', res1.method);
			test.strictEqual('GET', res2.method);
			test.strictEqual('p2p:myapp/myres', res1.uri);
			test.strictEqual('p2p:myapp/myres', res2.uri);
			test.deepEqual({}, res1.headers);
			test.deepEqual({}, res2.headers);
			test.strictEqual(false, res1.content_processed);
			test.strictEqual(true, res2.content_processed);
			test.done();		
		},
		
		"should parse message with headers in 2 parts" : function(test) {
			var str1 = 'GET p2p:myapp/myres\n'
				+ 'name:';			
			var str2 = 'value\n'
				+ '\n';
			
			var res1 = messenger.progressiveParse(str1);
			var res2 = messenger.progressiveParse(str2, res1);
			
			test.strictEqual('name:', res1.unparsed_part);
			test.strictEqual(undefined, res2.unparsed_part);
			test.strictEqual(false, res1.headers_processed);
			test.strictEqual(true, res2.headers_processed);
			test.strictEqual(false, res1.content_processed);
			test.strictEqual(true, res2.content_processed);
			test.deepEqual({}, res1.headers);
			test.deepEqual({name : 'value'}, res2.headers);
			test.done();		
		},
		
		"should parse message with headers in 2 parts, broken up at line break" : function(test) {
			var str1 = 'GET p2p:myapp/myres\n'
				+ 'name: value\n'
				+ 'one: 1';
			var str2 = '\n'
				+ '\n';
			
			var res1 = messenger.progressiveParse(str1);
			var res2 = messenger.progressiveParse(str2, res1);
			
			test.strictEqual('one: 1', res1.unparsed_part);
			test.strictEqual(undefined, res2.unparsed_part);
			test.strictEqual(false, res1.headers_processed);
			test.strictEqual(true, res2.headers_processed);
			test.strictEqual(false, res1.content_processed);
			test.strictEqual(true, res2.content_processed);
			test.deepEqual({name : 'value'}, res1.headers);
			test.deepEqual({name : 'value', one : '1'}, res2.headers);
			test.done();		
		},
		
		"should parse message with header and content in 2 parts, broken up at beginning of content" : function(test) {
			var str1 = 'GET p2p:myapp/myres\n'
				+ 'name: value\n'
				+ 'one: 1\n'
				+ 'content_length: 5\n'
				+ '\n';
			var str2 = '12345';
			
			var res1 = messenger.progressiveParse(str1);
			var res2 = messenger.progressiveParse(str2, res1);
			
			test.strictEqual(undefined, res1.unparsed_part);
			test.strictEqual(undefined, res2.unparsed_part);
			test.strictEqual(true, res1.headers_processed);
			test.strictEqual(true, res2.headers_processed);
			test.deepEqual({name : 'value', one : '1'}, res2.headers);
			test.strictEqual(false, res1.content_processed);
			test.strictEqual(true, res2.content_processed);
			test.strictEqual(undefined, res1.content);
			test.strictEqual(12345, res2.content);
			test.done();
		},
		
		"should parse message with header and content in 2 parts, broken up halfway through content" : function(test) {
			var str1 = 'GET p2p:myapp/myres\n'
				+ 'name: value\n'
				+ 'one: 1\n'
				+ 'content_length: 5\n'
				+ '\n'
				+ '12';
			var str2 = '345';
			
			var res1 = messenger.progressiveParse(str1);
			var res2 = messenger.progressiveParse(str2, res1);
			
			test.strictEqual('12', res1.unparsed_part);
			test.strictEqual(undefined, res2.unparsed_part);
			test.strictEqual(true, res1.headers_processed);
			test.strictEqual(true, res2.headers_processed);
			test.deepEqual({name : 'value', one : '1'}, res2.headers);
			test.strictEqual(false, res1.content_processed);
			test.strictEqual(true, res2.content_processed);
			test.strictEqual(undefined, res1.content);
			test.strictEqual(12345, res2.content);
			test.done();
		},
		
		"should throw on parsing if bad method" : function(test) {
			var str = 'MOO p2p:myapp/myres\n'
				+ 'name: value : \n'
				+ '\n';
			
			assert.throws(function() { messenger.progressiveParse(str); }, /unsupported method/i);
			test.done();
		},
		
		"should throw on parsing if no uri" : function(test) {
			var str = 'GET\n'
				+ 'name: value : \n'
				+ '\n';
			
			assert.throws(function() { messenger.progressiveParse(str); }, /missing destination uri/i);
			test.done();
		},
		
		"should throw on missing header value in 2 parts" : function(test) {
			var str1 = 'GET p2p:myapp/myres\n'
				+ 'name no';
			var str2 = 'value\n'
				+ '\n';
			
			var res1 = messenger.progressiveParse(str1);
			
			assert.throws(function() { messenger.progressiveParse(str2, res1); }, /bad header/i);
			test.done();
		}
	})
};