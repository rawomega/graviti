var sinon = require('sinon');
var assert = require('assert');
var events = require('events');
var dgram = require('dgram');
var langutil = require('common/langutil');
var udptran = require('messaging/udptran');
var testCase = require('nodeunit').testCase;
var logger = require('logmgr').getLogger('messaging/udptran');

module.exports = {		
	"starting a listener" : testCase({
		setUp : function(done) {
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';
			
			this.server = langutil.extend(new events.EventEmitter(), {bind : function() {}, close : function() {}});
			sinon.collection.stub(this.server, 'bind');

			sinon.collection.stub(dgram, 'createSocket').returns(this.server);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
	
		"should start to listen normally" : function(test) {
			var on = sinon.collection.stub(this.server, 'on');
			
			udptran.start(1234, "127.0.0.1");
	
			test.ok(on.calledWith('error'));
			test.ok(on.calledWith('message'));
			test.ok(on.calledWith('listening'));
			test.ok(this.server.bind.called);
			test.done();
		},
		
		"should try again if address in use" : function(test) {
			udptran.addrInUseRetryMsec = 100;
			var failTimeoutId = undefined;
			var listenCallCount = 0;			
			this.server.bind = function(port, addr) {
				listenCallCount++;
				test.equal('127.0.0.1', addr);
				test.equal(1234, port);
				if (listenCallCount >= 2) {
					test.done();
					if (failTimeoutId) clearTimeout(failTimeoutId);
				}
			};
			
			udptran.start(1234, "127.0.0.1");
			this.server.emit("error", { code : 'EADDRINUSE' });
			
			failTimeoutId = setTimeout(function() {
				test.fail() ;test.done(); }, 500);
		},
		
		"should handle close event on bound socket" : function(test) {
			udptran.start(1234, "127.0.0.1");

			this.server.emit('close');
			
			// not handled atm
			test.done();
		}
	}),
	
	"message sending" : testCase({
		setUp : function(done) {
			this.rawmsg = '{"key" : "val"}';
			this.client = langutil.extend(new events.EventEmitter(), { send : function() {}, bind : function() {} } )
			sinon.collection.stub(dgram, 'createSocket').returns(this.client);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should wrap in buffer and send" : function(test) {
			this.send = sinon.collection.stub(this.client, 'send');
			udptran.start(1234, "127.0.0.1");

			udptran.send(2222, "1.1.1.1", this.rawmsg);

			test.strictEqual(this.send.args[0][0].toString(), this.rawmsg);
			test.strictEqual(this.send.args[0][1], 0);
			test.strictEqual(this.send.args[0][2], 15);
			test.strictEqual(this.send.args[0][3], 2222);
			test.strictEqual(this.send.args[0][4], '1.1.1.1');
			test.ok(typeof(this.send.args[0][5]) === 'function');
			test.done();
		},
	
		"should handle error on send" : function(test) {
			var errorlog = sinon.collection.spy(logger, "error");
			this.send = sinon.collection.stub(this.client, 'send', function(buf, start, end, port, addr, cbk) {
				cbk(new Error('moo'));
			});
			udptran.start(1234, "127.0.0.1");

			udptran.send(2222, "1.1.1.1", this.rawmsg);
	
			test.ok(/moo/.test(errorlog.args[0][0]));
			test.done();
		},
	}),

	"message receiving" : testCase ({
		setUp : function(done) {			
			this.rinfo = { address : '2.2.2.2', port : 2222};
			
			this.callback = sinon.stub();
			this.server = langutil.extend(new events.EventEmitter(), {bind : function() {}});
			sinon.collection.stub(this.server, 'bind');
			sinon.collection.stub(dgram, 'createSocket').returns(this.server);
			
			//udptran._initSocket(this.socket);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should delegate to callback to parse message" : function(test) {
			udptran.start('1111', 'l1.1.1.1', { receivedDataCallback : this.callback });
			
			this.server.emit('message', 'some_data', this.rinfo);
			
			test.deepEqual(this.callback.args[0], [new String('some_data'), '2.2.2.2', undefined]);
			test.done();
		},
				
		"should absorb exception from parsing" : function(test) {
			this.callback = sinon.stub().throws(new Error('baah'));
			var infolog = sinon.collection.spy(logger, "info");
			udptran.start('1111', '1.1.1.1', { receivedDataCallback : this.callback });
			
			this.server.emit('message', 'some_data', this.rinfo);

			test.ok(/baah/.test(infolog.args[0][0]));
			test.done();
		},

		"should log and throw away packet when content only partially parsed by message parser" : function(test) {
			this.callback = sinon.stub().returns({ partial : 'state' });
			var warnlog = sinon.collection.spy(logger, "warn");
			udptran.start('1111', '1.1.1.1', { receivedDataCallback : this.callback });
			
			this.server.emit('message', 'some_data', this.rinfo);

			test.ok(/fully parse/.test(warnlog.args[0][0]));
			test.done();
		},
	}),

	"stopping the listener" : testCase ({		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop listening" : function(test) {
			udptran.server = {close : function() {}};
			var close = sinon.collection.stub(udptran.server, "close");
	
			// act
			udptran.stop();
	
			// assert
			test.ok(close.called);
			test.done();
		}
	})
};
