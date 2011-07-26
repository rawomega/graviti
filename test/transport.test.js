var sinon = require('sinon');
var assert = require('assert');
var message = require('message');
var events = require('events');
var net = require('net');
var dgram = require('dgram');
var langutil = require('langutil');
var transport = require('transport');
var logger = require('logmgr').getLogger('transport');
var testCase = require('nodeunit').testCase;
var mockutil = require('testability/mockutil');
var ringutil = require('ringutil');

module.exports = {
	"stack creation" : testCase({
		"create a transport stack with udp, tcp and a router" : function(test) {
			var router = sinon.stub();
		
			var res = transport.createStack('ABCD', 1234, '1.2.3.4', router);

			test.ok(res.udptran.port = 1234);
			test.ok(res.tcptran.port = 1234);
			test.ok(res.router === router);
			test.done();
		}
	}),
		
	"starting transports" : testCase({
		setUp : function(done) {
			this.processOn = sinon.collection.stub(process, 'on');
			
			this.udptran = mockutil.stubProto(transport.UdpTran);			
			this.tcptran = mockutil.stubProto(transport.TcpTran);
			this.readyCallback = sinon.stub();
			
			this.transport = new transport.TransportStack('ABCD', this.udptran, this.tcptran);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should set up exit hook on start" : function(test) {
			this.transport.start();
			
			test.ok(this.processOn.calledWith('exit', this.transport.stop));
			test.done();
		},
		
		"start tcp transport on start" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start');
			var udpStart = sinon.collection.stub(this.udptran, 'start');
			
			this.transport.start();
			
			test.strictEqual(tcpStart.args[0][0], this.transport.receiveRaw);
			test.strictEqual(typeof(tcpStart.args[0][1]), 'function');
			test.done();
		},
		
		"start udp transport on start" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start');
			var udpStart = sinon.collection.stub(this.udptran, 'start');
			
			this.transport.start();

			test.strictEqual(udpStart.args[0][0], this.transport.receiveRaw);
			test.strictEqual(typeof(udpStart.args[0][1]), 'function');
			test.done();
		},
		
		"do not delegate ready event if only tcp ready but not udp" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start', function(dataCbk, readyCbk) {
				readyCbk();
			});
			var udpStart = sinon.collection.stub(this.udptran, 'start');
			
			this.transport.start(this.readyCallback);
			
			test.ok(!this.readyCallback.called);
			test.done();
		},
		
		"do not delegate ready event if only udp ready but not tcp" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start');
			var udpStart = sinon.collection.stub(this.udptran, 'start', function(dataCbk, readyCbk) {
				readyCbk();
			});
			
			this.transport.start(this.readyCallback);
			
			test.ok(!this.readyCallback.called);
			test.done();
		},
		
		"delegate ready event when both udp and tcp ready" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start', function(dataCbk, readyCbk) {
				readyCbk();
			});
			var udpStart = sinon.collection.stub(this.udptran, 'start', function(dataCbk, readyCbk) {
				readyCbk();
			});
			
			this.transport.start(this.readyCallback);
			
			test.ok(this.readyCallback.called);
			test.done();
		}
	}),
	
	"stopping transports" : testCase({
		setUp : function(done) {
			this.udptran = new transport.UdpTran();
			this.tcptran = new transport.TcpTran();
			
			this.transport = new transport.TransportStack('ABCD', this.udptran, this.tcptran);
			
			this.tcpStop = sinon.collection.stub(this.tcptran, 'stop');
			this.udpStop = sinon.collection.stub(this.udptran, 'stop');
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"stop tcp transport on stop" : function(test) {
			this.transport.stop();
			
			test.ok(this.tcpStop.called);
			test.done();
		},
		
		"stop udp transport on stop" : function(test) {
			this.transport.stop();
			
			test.ok(this.udpStop.called);
			test.done();
		}
	}),
	
	"starting a tcp listener" : testCase({
		setUp : function(done) {
			this.processOn = sinon.collection.stub(process, 'on');
			
			this.tcptran = new transport.TcpTran(1234, "127.0.0.1");
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';

			this.server = langutil.extend(new events.EventEmitter(), {listen : function() {}, close : function() {}, address : function() { return {address : 'addr', port : 1234} }});
			sinon.collection.stub(this.server, 'listen', function(port, addr, cbk) {
				if (cbk) cbk();
			});

			this.socket = langutil.extend(new events.EventEmitter(), {remoteAddress : '6.6.6.6'});
						
			sinon.collection.stub(net, 'createServer').returns(this.server);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
	
		"should start to listen normally" : function(test) {
			var on = sinon.collection.stub(this.server, 'on');
			
			this.tcptran.start();
	
			test.ok(on.calledWith('error'));
			test.ok(on.calledWith('connection'));
			test.ok(on.calledWith('close'));
			test.ok(this.server.listen.called);
			test.done();
		},
		
		"should call ready callback when starting to listen normally" : function(test) {
			var cbk = sinon.stub();
			
			this.tcptran.start(undefined, cbk);
			this.server.emit('listening');
	
			test.ok(cbk.called);
			test.done();
		},
		
		"should try again if address in use" : function(test) {
			this.tcptran.addrInUseRetryMsec = 100;
			var failTimeoutId = undefined;
			var listenCallCount = 0;			
			this.server.listen = function(port, addr) {
				listenCallCount++;
				test.equal('127.0.0.1', addr);
				test.equal(1234, port);
				if (listenCallCount >= 2) {
					test.done();
					if (failTimeoutId) clearTimeout(failTimeoutId);
				}
			};
			
			this.tcptran.start();
			this.server.emit("error", { code : 'EADDRINUSE' });
			
			failTimeoutId = setTimeout(function() {
				test.fail() ;test.done(); }, 500);
		},
		
		"should handle close event on socket of a received connection" : function(test) {
			this.tcptran.start();
			this.server.emit('connection', this.socket);
			
			this.socket.emit('close');
			
			// TODO: for now we just log on socket close, add assertions when we do more
			test.done();
		}
	}),
	
	"tcp message sending" : testCase({
		setUp : function(done) {
			this.tcptran = new transport.TcpTran();
			this.rawmsg = '{"key" : "val"}';
			this.client = langutil.extend(new events.EventEmitter(), { write : function() {}, end : function() {}, setEncoding : function() {} } );
			
			net.createConnection = function () {};
			sinon.collection.stub(net, 'createConnection').returns(this.client);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should establish connection and send" : function(test) {
			var setEncoding = sinon.collection.stub(this.client, 'setEncoding');
			var write = sinon.collection.stub(this.client, 'write', function(data, enc, cbk) {
				cbk();
			});
			var end = sinon.collection.stub(this.client, 'end');
			
			this.tcptran.send(2222, "1.1.1.1", this.rawmsg);
			this.client.emit('connect');
	
			test.ok(setEncoding.calledWith('UTF-8'));
			test.ok(write.calledWith(this.rawmsg, 'UTF8'));
//			test.ok(end.called);
			test.done();
		},
	
		"should handle close on connection used to send data" : function(test) {
			this.tcptran.send(2222, "1.1.1.1", this.rawmsg);
			this.client.emit('close');
	
			// for now we don't do anything
			test.done();
		},
		
		"should handle received data on connection used to send data" : function(test) {
			this.tcptran.send(2222, "1.1.1.1", this.rawmsg);
			this.client.emit('data', 'moo');
	
			// for now we just log
			test.done();
		}
	}),

	"tcp message receiving" : testCase ({
		setUp : function(done) {
			this.tcptran = new transport.TcpTran('1111', '1.1.1.1');
			this.socket = langutil.extend(new events.EventEmitter(), {end : function() {}});
			this.existingParsed = { existing : 'parsed'};
			this.socketEnd = sinon.stub(this.socket, 'end');
			this.socket.existingParsed = this.existingParsed;
			this.socket.remoteAddress = '2.2.2.2';		
			
			this.callback = sinon.stub();
			this.server = langutil.extend(new events.EventEmitter(), {listen : function() {}});
			sinon.collection.stub(this.server, 'listen');
			sinon.collection.stub(net, 'createServer').returns(this.server);
			
			this.tcptran._initSocket(this.socket);
			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should delegate to callback to parse message" : function(test) {
			this.tcptran.start(this.callback);
			
			this.socket.emit('data', 'some_data');
			
			test.deepEqual(this.callback.args[0], [new String('some_data'), '2.2.2.2', this.existingParsed]);
			test.done();
		},
		
		"should close socket on parsing if fully parsed" : function(test) {
			this.tcptran.start(this.callback);
			
			this.socket.emit('data', 'some_data');
			
			test.ok(this.socketEnd.called);
			test.done();
		},
		
		"should absorb exception from parsing" : function(test) {
			this.callback = sinon.stub().throws(new Error());
			this.tcptran.start(this.callback);
			
			this.socket.emit('data', 'some_data');
			
			test.ok(this.socketEnd.called);
			test.done();
		},
		
		"should store partial parse state in socket" : function(test) {
			this.callback = sinon.stub().returns({ partial : 'state' });
			this.tcptran.start(this.callback);
			
			this.socket.emit('data', 'some_data');
			
			test.deepEqual(this.callback.args[0], [new String('some_data'), '2.2.2.2', this.existingParsed]);
			test.deepEqual({partial : 'state'}, this.socket.existingParsed);
			test.ok(!this.socketEnd.called);
			test.done();
		}
	}),
	
	"stopping the tcp listener" : testCase ({
		setUp : function(done) {
			this.tcptran = new transport.TcpTran();
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop listening" : function(test) {
			this.tcptran.server = {close : function() {}};
			var close = sinon.collection.stub(this.tcptran.server, "close");
	
			this.tcptran.stop();
	
			test.ok(close.called);
			test.done();
		}
	}),
	
	"starting a udp listener" : testCase({
		setUp : function(done) {
			this.processOn = sinon.collection.stub(process, 'on');		
		
			this.udptran = new transport.UdpTran(1234, "127.0.0.1");
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
		
		"should start to listen normally" : function(test) {
			var on = sinon.collection.stub(this.server, 'on');
			
			this.udptran.start();
	
			test.ok(on.calledWith('error'));
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
	
	"udp message sending" : testCase({
		setUp : function(done) {
			this.udptran = new transport.UdpTran(1234, "127.0.0.1");
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

	"udp message receiving" : testCase ({
		setUp : function(done) {			
			this.udptran = new transport.UdpTran(1111, 'l1.1.1.1');
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

	"stopping the udp listener" : testCase ({
		setUp : function(done) {
			this.udptran = new transport.UdpTran();
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
	}),
	
	"sending raw messages through given channels" : testCase({
		setUp : function(done) {
			this.udptran = new transport.UdpTran(1234);
			this.tcptran = new transport.TcpTran(1234);
			this.readyCallback = sinon.stub();
			
			this.transport = new transport.TransportStack('ABCD', this.udptran, this.tcptran);

			this.udpSend = sinon.collection.stub(this.udptran, 'send');
			this.tcpSend = sinon.collection.stub(this.tcptran, 'send');
			this.msg = new message.Message('p2p:myapp/myuri', {"key" : "val"});			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should send with hop zero" : function(test) {
			sinon.stub(this.msg, 'stringify').returns('stringified');
			
			this.transport.sendMessage(2222, "1.1.1.1", this.msg);
	
			test.strictEqual(2222, this.udpSend.args[0][0]);
			test.strictEqual('1.1.1.1', this.udpSend.args[0][1]);
			test.strictEqual('stringified', this.udpSend.args[0][2]);
			test.done();
		},

		"should increment hop count when sending" : function(test) {
			this.msg = new message.Message('p2p:myapp/myuri', {"key" : "val"}, {"hops" : 11});
	
			this.transport.sendMessage("1.1.1.1", 2222, this.msg);

			test.ok(/hops: 12/.test(this.udpSend.args[0][2]));
			test.done();
		},
		
		"should add node id when absent" : function(test) {
			this.transport.sendMessage("1.1.1.1", 2222, this.msg);

			test.ok(/source_id: ABCD/.test(this.udpSend.args[0][2]));
			test.done();
		},
		
		"should add port number when sending" : function(test) {
			this.transport.sendMessage("1.1.1.1", 2222, this.msg);

			test.ok(/sender_port: 1234/.test(this.udpSend.args[0][2]));
			test.ok(/source_port: 1234/.test(this.udpSend.args[0][2]));
			test.done();
		},
		
		"send via udp if data size below datagram size threshold" : function(test) {			
			sinon.stub(this.msg, 'stringify').returns('stringified');
			
			this.transport.sendMessage(1111, '1.1.1.1', this.msg);
			
			test.ok(this.udpSend.calledWith(1111, '1.1.1.1', "stringified"));
			test.done();
		},
		
		"send via tcp if data size above datagram size threshold" : function(test) {
			var hundred = 'ABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXY\n';
			var bigData = '';
			for (var i = 0; i < 20; i++ && (bigData = bigData.concat(hundred)));
			sinon.stub(this.msg, 'stringify').returns(bigData);			
			
			this.transport.sendMessage(1111, '1.1.1.1', this.msg);
			
			test.ok(this.tcpSend.calledWith(1111, '1.1.1.1', bigData));
			test.done();
		}
	}),
	
	"receiving and parsing raw messages " : testCase({
		setUp : function(done) {
			this.udptran = mockutil.stubProto(transport.UdpTran);			
			this.tcptran = mockutil.stubProto(transport.TcpTran);
			this.transport = new transport.TransportStack('ABCD', this.udptran, this.tcptran);
			sinon.collection.stub(this.transport, '_processMessage');
			sinon.collection.stub(this.transport, 'sendMessage');
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';
			done();
		},

		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"should handle unparseable message through socket" : function(test) {
			this.transport.on('message', function() {test.fail('unexpected message');});			

			this.transport.receiveRaw('badmsg', '127.0.0.1');
			
			test.done();
		},

		"should not process if no uri in message" : function(test) {
			var self = this;
			this.transport.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transport.receiveRaw('GET\n\n{"key" : "val"}', '127.0.0.1');
			}, /destination uri/i);	
			test.done();
		},
		
		"should throw if hop count over 100" : function(test) {
			var self = this;
			this.transport.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transport.receiveRaw('GET p2p:graviti/something\n' +
						'source_port : 123\n' +
						'hops : 101\n\n', '127.0.0.1');
			}, /too many hops/i);			
			test.done();
		},

		"should throw if no source port in message" : function(test) {
			var self = this;
			this.transport.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transport.receiveRaw('GET p2p:graviti/something\n\n', '1.2.3.4');
			}, /source port/i);
			test.done();
		},

		"should throw if no sender port in message" : function(test) {
			var self = this;
			this.transport.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transport.receiveRaw('GET p2p:graviti/something\n'
						+ 'source_port: 123\n\n', '1.2.3.4');
			}, /sender port/i);
			test.done();
		},

		"should handle parseable message callback" : function(test) {
			// setup
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			this.transport.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			// act
			this.transport.receiveRaw('GET p2p:myapp/something\n' +
					'source_port : 1111\n' +
					'sender_port : 2222\n' +
					'key: val\n\n',
				'6.6.6.6');
			
			// assert
			test.strictEqual('val', rcvdmsg.key);
			test.strictEqual('6.6.6.6:2222', rcvdmsginfo.sender_ap);
			test.strictEqual('6.6.6.6:1111', rcvdmsginfo.source_ap);			
			test.strictEqual('myapp', rcvdmsginfo.app_name);
			test.done();
		},
		
		"should handle parseable message in two parts" : function(test) {
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			this.transport.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			var inProgressState = this.transport.receiveRaw('GET p2p:myapp/something\n', '6.6.6.6');
			this.transport.receiveRaw('source_port : 1111\n' +
					'sender_port : 2222\n' +
					'key: val\n\n',
				'6.6.6.6', inProgressState
			);
			
			test.strictEqual('val', rcvdmsg.key);
			test.strictEqual('6.6.6.6:2222', rcvdmsginfo.sender_ap);
			test.strictEqual('6.6.6.6:1111', rcvdmsginfo.source_ap);
			test.strictEqual('myapp', rcvdmsginfo.app_name);
			test.done();
		},
		
		"should add source addr to message if not present" : function(test) {
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			this.transport.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			this.transport.receiveRaw('GET p2p:myapp/something\n' +
					'source_port : 1111\n' +
					'sender_port : 2222\n\n',
				'6.6.6.6'
			);
			
			test.strictEqual('6.6.6.6', rcvdmsg.source_addr);
			test.done();
		}
	}),
	
	"handling and eventing of received and parsed messages" : testCase({
		setUp : function(done) {
			this.router = { getNextHop : function() {}, suggestBetterHop : function() {} };
			this.udptran = mockutil.stubProto(transport.UdpTran);			
			this.tcptran = mockutil.stubProto(transport.TcpTran);
			this.transport = new transport.TransportStack('ABCD', this.udptran, this.tcptran, this.router);
			
			this.sendMessage = sinon.stub(this.transport, 'sendMessage');
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.gravitiForwarding = sinon.stub();
			this.gravitiReceived = sinon.stub();
			this.msg = { dest_id : 'FEED', he : 'llo'};
			this.msginfo = {
					source_ap : '3.3.3.3:3333',
					app_name : 'myapp'					
			};

			this.transport.on('app-message-forwarding', this.appForwarding);
			this.transport.on('app-message-received', this.appReceived);
			this.transport.on('graviti-message-forwarding', this.gravitiForwarding);
			this.transport.on('graviti-message-received', this.gravitiReceived);

			this.nextHop = {
					id : 'CDEF',
					addr : '5.5.5.5',
					port : 5555
				};
			sinon.stub(this.router, 'getNextHop').returns(this.nextHop);
			
			done();
		},
		
		"handle message destined for an app on this node" : function(test) {
			this.nextHop.id = this.transport.nodeId;
			
			this.transport._processMessage(this.msg, this.msginfo);
			
			test.deepEqual(this.appReceived.args[0][0], this.msg);
			test.deepEqual(this.appReceived.args[0][1], this.msginfo);
			test.ok(!this.appForwarding.called);
			test.ok(!this.gravitiForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		},
		
		"handle message destined for graviti on this node" : function(test) {
			this.nextHop.id = this.transport.nodeId;
			this.msginfo.app_name = 'graviti';
			
			this.transport._processMessage(this.msg, this.msginfo);
			
			test.deepEqual(this.gravitiReceived.args[0][0], this.msg);
			test.deepEqual(this.gravitiReceived.args[0][1], this.msginfo);
			test.ok(!this.appForwarding.called);
			test.ok(!this.appReceived.called);
			test.ok(!this.gravitiForwarding.called);
			test.done();
		},
		
		"handle message destined for an app on another node" : function(test) {
			this.transport._processMessage(this.msg, this.msginfo);
			
			test.strictEqual(this.sendMessage.args[0][0], 5555);		
			test.strictEqual(this.sendMessage.args[0][1], '5.5.5.5');
			test.deepEqual(this.sendMessage.args[0][2], this.msg);
			test.deepEqual(this.appForwarding.args[0][0], this.msg);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.ok(!this.gravitiForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		},
		
		"handle message destined for graviti on another node" : function(test) {
			this.msginfo.app_name = 'graviti';
			
			this.transport._processMessage(this.msg, this.msginfo);
			
			test.strictEqual(this.sendMessage.args[0][0], 5555);		
			test.strictEqual(this.sendMessage.args[0][1], '5.5.5.5');
			test.deepEqual(this.sendMessage.args[0][2], this.msg);
			test.deepEqual(this.gravitiForwarding.args[0][0], this.msg);
			test.deepEqual(this.gravitiForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.ok(!this.appForwarding.called);
			test.ok(!this.gravitiReceived.called);
			test.done();
		}
	}),
	
	"sending messages" : testCase({
		setUp : function(done) {
			this.router = { getNextHop : function() {}, suggestBetterHop : function() {} };
			this.udptran = mockutil.stubProto(transport.UdpTran);			
			this.tcptran = mockutil.stubProto(transport.TcpTran);
			this.transport = new transport.TransportStack('ABCD', this.udptran, this.tcptran, this.router);
			
			sinon.collection.stub(Date, 'now').returns(12345678);
			this.nextHop = {
					id : 'CDEF',
					addr : '5.5.5.5',
					port : 5555
				};
			sinon.stub(this.router, 'getNextHop').returns(this.nextHop);
			
			this.uri = 'p2p:myapp/myresource';
			this.content = {my : 'content'};
			this.sendMessage = sinon.stub(this.transport, 'sendMessage');
			this.appForwarding = sinon.stub();
			this.appReceived = sinon.stub();
			this.msginfo = {
					app_name : 'myapp',
					next_hop_id : 'CDEF',
					next_hop_addr : '5.5.5.5',
					next_hop_port : 5555
			};

			this.transport.on('app-message-forwarding', this.appForwarding);
			this.transport.on('app-message-received', this.appReceived);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"be able to send a message to a uri mapping to a remote node" : function(test) {
			var destId = ringutil.parseUri(this.uri).hash;
			
			this.transport.send(this.uri, this.content, {method : 'POST'});
			
			test.strictEqual(this.sendMessage.args[0][0], 5555);			
			test.strictEqual(this.sendMessage.args[0][1], '5.5.5.5');
			test.strictEqual(this.sendMessage.args[0][2].uri, this.uri);
			test.strictEqual(this.sendMessage.args[0][2].dest_id, destId);
			test.strictEqual(this.sendMessage.args[0][2].method, 'POST');
			test.deepEqual(this.sendMessage.args[0][2].content, this.content);
			test.deepEqual(this.appForwarding.args[0][0], this.sendMessage.args[0][2]);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.done();
		},
		
		"be able to send a message to a uri mapping to the current node" : function(test) {
			var destId =  ringutil.parseUri(this.uri).hash;
			this.nextHop.id = this.transport.nodeId;
			
			this.transport.send(this.uri, this.content, {method : 'POST'});
						
			test.ok(!this.sendMessage.called);
			test.ok(!this.appForwarding.called);
			test.strictEqual(this.appReceived.args[0][0].uri, this.uri);
			test.strictEqual(this.appReceived.args[0][0].dest_id, destId);
			test.strictEqual(this.appReceived.args[0][0].method, 'POST');
			test.deepEqual(this.appReceived.args[0][0].content, this.content);
			test.deepEqual(this.appReceived.args[0][1], { app_name : 'myapp' });
			test.done();
		},
		
		"be able to send a message directly to an address" : function(test) {
			this.transport.sendToAddr(this.uri, this.content, {method : 'POST'}, '3.3.3.3', 3333);

			test.ok(!this.appForwarding.called);
			test.ok(!this.appReceived.called);
			test.strictEqual(this.sendMessage.args[0][0], 3333);			
			test.strictEqual(this.sendMessage.args[0][1], '3.3.3.3');
			test.strictEqual(this.sendMessage.args[0][2].uri, this.uri);
			test.strictEqual(this.sendMessage.args[0][2].dest_id, undefined);
			test.strictEqual(this.sendMessage.args[0][2].method, 'POST');
			test.deepEqual(this.sendMessage.args[0][2].content, this.content);
			test.done();
		},
		
		"be able to send a message directly to an id when remote node is nearest" : function(test) {
			var destId = 'AAAA';
						
			this.transport.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.strictEqual(this.sendMessage.args[0][0], 5555);			
			test.strictEqual(this.sendMessage.args[0][1], '5.5.5.5');
			test.strictEqual(this.sendMessage.args[0][2].uri, this.uri);
			test.strictEqual(this.sendMessage.args[0][2].dest_id, destId);
			test.strictEqual(this.sendMessage.args[0][2].method, 'POST');
			test.deepEqual(this.sendMessage.args[0][2].content, this.content);
			test.deepEqual(this.appForwarding.args[0][0], this.sendMessage.args[0][2]);
			test.deepEqual(this.appForwarding.args[0][1], this.msginfo);
			test.ok(!this.appReceived.called);
			test.done();
		},
		
		"be able to send a message directly to an id when current node is nearest" : function(test) {
			var destId = 'AAAA';
			this.nextHop.id = this.transport.nodeId;
						
			this.transport.sendToId(this.uri, this.content, {method : 'POST'}, 'AAAA');

			test.ok(!this.sendMessage.called);
			test.ok(!this.appForwarding.called);
			test.strictEqual(this.appReceived.args[0][0].uri, this.uri);
			test.strictEqual(this.appReceived.args[0][0].dest_id, destId);
			test.strictEqual(this.appReceived.args[0][0].method, 'POST');
			test.deepEqual(this.appReceived.args[0][0].content, this.content);
			test.deepEqual(this.appReceived.args[0][1], { app_name : 'myapp' });
			test.done();
		}
	})
};
