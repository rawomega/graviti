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
			this.processOn = sinon.collection.stub(process, 'on');		
		
			this.udptran = new udptran.UdpTran(1234, "127.0.0.1");
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';
			
			this.server = langutil.extend(new events.EventEmitter(), {bind : function() {}, close : function() {}, address : function() { return {address : 'addr', port: 123}} });
			sinon.collection.stub(this.server, 'bind');

			sinon.collection.stub(dgram, 'createSocket').returns(this.server);			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should set up exit hook on start" : function(test) {
			test.ok(this.processOn.calledWith('exit', this.udptran.stop));
			test.done();
		},
	
		"should start to listen normally" : function(test) {
			var on = sinon.collection.stub(this.server, 'on');
			
			this.udptran.start();
	
			test.ok(on.calledWith('error'));
			test.ok(on.calledWith('message'));
			test.ok(on.calledWith('listening'));
			test.ok(this.server.bind.called);
			test.done();
		},
		
		"should call ready callback when starting to listen normally" : function(test) {
			var cbk = sinon.stub();
			
			this.udptran.start(undefined, cbk);
			this.server.emit('listening');
	
			test.ok(cbk.called);
			test.done();
		},
		
		"should try again if address in use" : function(test) {
			this.udptran.addrInUseRetryMsec = 100;
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
			
			this.udptran.start();
			this.server.emit("error", { code : 'EADDRINUSE' });
			
			failTimeoutId = setTimeout(function() {
				test.fail() ;test.done(); }, 500);
		},
		
		"should handle close event on bound socket" : function(test) {
			this.udptran.start();

			this.server.emit('close');
			
			// not handled atm
			test.done();
		}
	}),
	
	"message sending" : testCase({
		setUp : function(done) {
			this.udptran = new udptran.UdpTran(1234, "127.0.0.1");
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
			this.udptran.start();

			this.udptran.send(2222, "1.1.1.1", this.rawmsg);

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
			this.udptran.start();

			this.udptran.send(2222, "1.1.1.1", this.rawmsg);
	
			test.ok(/moo/.test(errorlog.args[0][0]));
			test.done();
		},
	}),

	"message receiving" : testCase ({
		setUp : function(done) {			
			this.udptran = new udptran.UdpTran(1111, 'l1.1.1.1');
			this.rinfo = { address : '2.2.2.2', port : 2222};
			
			this.callback = sinon.stub();
			this.server = langutil.extend(new events.EventEmitter(), {bind : function() {}});
			sinon.collection.stub(this.server, 'bind');
			sinon.collection.stub(dgram, 'createSocket').returns(this.server);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should delegate to callback to parse message" : function(test) {
			this.udptran.start(this.callback);
			
			this.server.emit('message', 'some_data', this.rinfo);
			
			test.deepEqual(this.callback.args[0], [new String('some_data'), '2.2.2.2', undefined]);
			test.done();
		},
				
		"should absorb exception from parsing" : function(test) {
			this.callback = sinon.stub().throws(new Error('baah'));
			var infolog = sinon.collection.spy(logger, "info");
			this.udptran.start(this.callback);
			
			this.server.emit('message', 'some_data', this.rinfo);

			test.ok(/baah/.test(infolog.args[0][0]));
			test.done();
		},

		"should log and throw away packet when content only partially parsed by message parser" : function(test) {
			this.callback = sinon.stub().returns({ partial : 'state' });
			var warnlog = sinon.collection.spy(logger, "warn");
			this.udptran.start(this.callback);
			
			this.server.emit('message', 'some_data', this.rinfo);

			test.ok(/fully parse/.test(warnlog.args[0][0]));
			test.done();
		},
	}),

	"stopping the listener" : testCase ({
		setUp : function(done) {
			this.udptran = new udptran.UdpTran();
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop listening" : function(test) {
			this.udptran.server = {close : function() {}};
			var close = sinon.collection.stub(this.udptran.server, "close");
	
			// act
			this.udptran.stop();
	
			// assert
			test.ok(close.called);
			test.done();
		}
	})
};
