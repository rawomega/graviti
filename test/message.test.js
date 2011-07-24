var node = require('core/node');
var assert = require('assert');
var testCase = require('nodeunit').testCase;
var message = require('message');
var myId = 'ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234';
	
module.exports = {
	"creating a message" : testCase({
		setUp : function(done) {
			node.nodeId = myId;
			done();
		}, 
		
		"creating a message with no dest uri" : function(test) {
			assert.throws(function() { new message.Message(); }, /missing destination uri/i);
			test.done();
		},
		
		"creating a message with only dest uri" : function(test) {
			node.nodeId = myId;
			var msg = new message.Message('p2p:myuri/myres');
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('GET', msg.method);
			test.strictEqual(undefined, msg.dest_id);
			test.strictEqual(undefined, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri and blank dest id" : function(test) {
			node.nodeId = myId;
			var msg = new message.Message('p2p:myuri/myres', undefined, undefined, 'NIL');
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('GET', msg.method);
			test.strictEqual(undefined, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
	
		"creating a message with dest uri and content" : function(test) {
			var msg = new message.Message('p2p:myuri/myres', {a : 'ay', b : 'bee'});
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('GET', msg.method);
			test.strictEqual(undefined, msg.dest_id);
			test.deepEqual({a : 'ay', b : 'bee'}, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri and a mix of additional and overridden headers" : function(test) {
			var msg = new message.Message('p2p:myuri/myres', undefined, {method : 'POST', myheader : 'moo'});
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('POST', msg.method);
			test.strictEqual('moo', msg.myheader);
			test.strictEqual(undefined, msg.dest_id);			
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with dest uri, content and a mix of additional and overridden headers" : function(test) {
			var msg = new message.Message('p2p:myuri/myres', {a : 'ay', b : 'bee'}, {method : 'POST', myheader : 'baa'});
		
			test.strictEqual('p2p:myuri/myres', msg.uri);
			test.strictEqual(myId, msg.source_id);
			test.strictEqual('POST', msg.method);
			test.strictEqual('baa', msg.myheader);
			test.strictEqual(undefined, msg.dest_id);
			test.deepEqual({a : 'ay', b : 'bee'}, msg.content);
			test.ok(msg.msg_id.length > 0);
			test.ok(msg.created > 0);			
			test.done();
		},
		
		"creating a message with a specified dest id" : function(test) {
			var msg = new message.Message('p2p:myuri/myres', {a : 'ay', b : 'bee'}, {method : 'POST', myheader : 'baa'}, 'AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB');
		
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
		
		tearDown : function(done) {
			message.maxMessageSize = 65535;
			done();
		},

		"stringify a message with only dest uri" : function(test) {
			var str = new message.Message('p2p:myuri/myres').stringify();
			var lines = str.split('\n');

			test.equal(6, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(!/dest_id:/.test(str));
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(4, lines.indexOf(''));
			test.equal(5, lines.lastIndexOf(''));
			test.done();
		},
		
		"stringify a message with dest uri and content" : function(test) {
			var str = new message.Message('p2p:myuri/myres', this.content).stringify();
			var lines = str.split('\n');

			test.equal(7, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(!/dest_id:/.test(str));
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(5, lines.indexOf(''));
			test.equal(JSON.stringify(this.content), lines[6]);
			test.done();
		},
		
		"stringify a message with dest uri, content and custom headers" : function(test) {
			var str = new message.Message('p2p:myuri/myres', this.content, {custom: 'header'}).stringify();
			var lines = str.split('\n');

			test.equal(8, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('source_id: ' + myId) > 0);
			test.ok(lines.indexOf('custom: header') > 0);
			test.ok(lines.indexOf('content_length: 20') > 0);
			test.ok(!/dest_id:/.test(str));
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(6, lines.indexOf(''));
			test.equal(JSON.stringify(this.content), lines[7]);
			test.done();
		},
		
		"stringify a message for a specific dest id" : function(test) {
			var str = new message.Message('p2p:myuri/myres', this.content, {custom: 'header'}, 'AAAAABBBBBAAAAABBBBBAAAAABBBBBAAAAABBBBB').stringify();
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
		},
		
		"stringify a message with non-json content" : function(test) {
			var str = new message.Message('p2p:myuri/myres', '{not-json}', {content_type: 'text/plain'}).stringify();
			var lines = str.split('\n');

			test.equal(8, lines.length);
			test.ok(lines.indexOf('GET p2p:myuri/myres') === 0);
			test.ok(lines.indexOf('content_type: text/plain') > 0);
			test.ok(lines.indexOf('content_length: 10') > 0);
			test.ok(/msg_id: [0-9A-F\-]{36}\n/.test(str));
			test.ok(/created: \d+\n/.test(str));
			test.equal(6, lines.indexOf(''));
			test.equal('{not-json}', lines[7]);
			test.done();
		},
		
		"fail to stringify a message that is too big" : function(test) {
			message.maxMessageSize = 5;
			
			assert.throws(function() {
				 new message.Message('p2p:myuri/myres', '{"a": "b"}', {content_type: 'text/plain'}).stringify();
			}, /size too big/i);
			test.done();
		},
	}),
	
	"creating and stringifying an ACK " : testCase({
		"creating an ACK message" : function(test) {
			var ack = new message.Ack('myid');;
			
			delete ack.stringify;
			test.deepEqual({method : 'ACK', msg_id : 'myid'}, ack)		
			test.done();
		},
	
		"stringifying an ACK message" : function(test) {
			var ack = new message.Ack('myid');;
			
			test.strictEqual('ACK myid', ack.stringify());		
			test.done();
		}	
	})
};