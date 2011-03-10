var node = require('core/node');
var assert = require('assert');
var testCase = require('nodeunit').testCase;
var messenger = require('core/messenger');
var myId = 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234';
	
module.exports = {
	"creating a message" : testCase({
		setUp : function(done) {
			node.nodeId = myId;
			done();
		}, 
		
		"creating a message with no dest uri" : function(test) {
			assert.throws(function() { new messenger.Message(); }, /missing destination uri/i);
			test.done();
		},
		
		"creating a message with only dest uri" : function(test) {
			node.nodeId = myId;
			var msg = new messenger.Message('p2p:myuri/myres');
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('GET', msg.method);
			test.strictEqual('31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1', msg.dest_id);
			test.strictEqual(undefined, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri and blank dest id" : function(test) {
			node.nodeId = myId;
			var msg = new messenger.Message('p2p:myuri/myres', undefined, undefined, 'NIL');
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('GET', msg.method);
			test.strictEqual(undefined, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri and content" : function(test) {
			var msg = new messenger.Message('p2p:myuri/myres', {a : 'ay', b : 'bee'});
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('GET', msg.method);
			test.strictEqual('31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1', msg.dest_id);
			test.deepEqual({a : 'ay', b : 'bee'}, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri and a mix of additional and overridden headers" : function(test) {
			var msg = new messenger.Message('p2p:myuri/myres', undefined, {method : 'POST', myheader : 'moo'});
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('POST', msg.method);
			test.strictEqual('moo', msg.myheader);
			test.strictEqual('31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1', msg.dest_id);			
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri, content and a mix of additional and overridden headers" : function(test) {
			var msg = new messenger.Message('p2p:myuri/myres', {a : 'ay', b : 'bee'}, {method : 'POST', myheader : 'baa'});
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('POST', msg.method);
			test.strictEqual('baa', msg.myheader);
			test.strictEqual('31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1', msg.dest_id);
			test.deepEqual({a : 'ay', b : 'bee'}, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with a specified dest id" : function(test) {
			var msg = new messenger.Message('p2p:myuri/myres', {a : 'ay', b : 'bee'}, {method : 'POST', myheader : 'baa'}, 'AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB');
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('POST', msg.method);
			test.strictEqual('baa', msg.myheader);
			test.strictEqual('AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB', msg.dest_id);
			test.deepEqual({a : 'ay', b : 'bee'}, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		}
	}),
	
	"stringifying a message" : testCase({
		setUp : function(done) {
			node.nodeId = myId;
			this.content = {a : 'ay', b : 'bee'}; 
			done();
		}, 

		"stringify a message with only dest uri" : function(test) {
			var str = new messenger.Message('p2p:myuri/myres').stringify();
			var lines = str.split('\n');

			test.equal(7, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(lines.indexOf('dest_id: ' + '31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1') > 0);
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(5, lines.indexOf(''));
			test.equal(6, lines.lastIndexOf(''));
			test.done();
		},
		
		"stringify a message with dest uri and content" : function(test) {
			var str = new messenger.Message('p2p:myuri/myres', this.content).stringify();
			var lines = str.split('\n');

			test.equal(8, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(lines.indexOf('dest_id: ' + '31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1') > 0);
			test.ok(lines.indexOf('content_length: 20') > 0);
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(6, lines.indexOf(''));
			test.equal(JSON.stringify(this.content), lines[7]);
			test.done();
		},
		
		"stringify a message with dest uri, content and custome headers" : function(test) {
			var str = new messenger.Message('p2p:myuri/myres', this.content, {custom: 'header'}).stringify();
			var lines = str.split('\n');

			test.equal(9, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(lines.indexOf('custom: header') > 0);
			test.ok(lines.indexOf('dest_id: ' + '31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1') > 0);
			test.ok(lines.indexOf('content_length: 20') > 0);
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(7, lines.indexOf(''));
			test.equal(JSON.stringify(this.content), lines[8]);
			test.done();
		},
		
		"stringify a message for a specific dest id" : function(test) {
			var str = new messenger.Message('p2p:myuri/myres', this.content, {custom: 'header'}, 'AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB').stringify();
			var lines = str.split('\n');

			test.equal(9, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(lines.indexOf('custom: header') > 0);
			test.ok(lines.indexOf('dest_id: ' + 'AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB') > 0);
			test.ok(lines.indexOf('content_length: 20') > 0);
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(7, lines.indexOf(''));
			test.equal(JSON.stringify(this.content), lines[8]);
			test.done();
		}
	}),
	
	"parsing a message" : testCase({
		setUp : function(done) {
			node.nodeId = myId;
			this.content = {a : 'ay', b : 'bee'}; 
			done();
		}, 
		
		"should parse simple message with uri and method only" : function(test) {
			var str = 'GET p2p:myapp/myres\n\n';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('GET', msg.method);
			test.strictEqual('p2p:myapp/myres', msg.uri);
			test.strictEqual('31ED6B82A0A15D8A150CFDFAA5E1A4351995C4E1', msg.dest_id);
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
			test.strictEqual('10', msg.content_length);
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
				+ '\n';
			
			var msg = messenger.parse(str);
			
			test.strictEqual('10', msg.content_length);
			test.strictEqual('AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB', msg.dest_id);
			test.strictEqual('my header value', msg['my header name']);
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
		}
	})
};