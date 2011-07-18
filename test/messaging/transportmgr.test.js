var sinon = require('sinon');
var langutil = require('common/langutil');
var mockutil = require('testability/mockutil');
var transportmgr = require('messaging/transportmgr');
var messageparser = require('messaging/messageparser');
var messages = require('messaging/messages');
var tcptran = require('messaging/tcptran');
var udptran = require('messaging/udptran');
var testCase = require('nodeunit').testCase;
var assert = require('assert');

module.exports = {		
	"starting transports" : testCase({
		setUp : function(done) {
			this.udptran = mockutil.stubProto(udptran.UdpTran);			
			this.tcptran = mockutil.stubProto(tcptran.TcpTran);
			this.messageparser = new messageparser.MessageParser();
			this.readyCallback = sinon.stub();
			
			this.transportmgr = new transportmgr.TransportMgr(this.udptran, this.tcptran, this.messageparser);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"start tcp transport on start" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start');
			var udpStart = sinon.collection.stub(this.udptran, 'start');
			
			this.transportmgr.start();
			
			test.strictEqual(tcpStart.args[0][0], this.transportmgr.receiveData);
			test.strictEqual(typeof(tcpStart.args[0][1]), 'function');
			test.done();
		},
		
		"start udp transport on start" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start');
			var udpStart = sinon.collection.stub(this.udptran, 'start');
			
			this.transportmgr.start();

			test.strictEqual(udpStart.args[0][0], this.transportmgr.receiveData);
			test.strictEqual(typeof(udpStart.args[0][1]), 'function');
			test.done();
		},
		
		"do not delegate ready event if only tcp ready but not udp" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start', function(dataCbk, readyCbk) {
				readyCbk();
			});
			var udpStart = sinon.collection.stub(this.udptran, 'start');
			this.transportmgr.on('ready', this.readyCallback);
			
			this.transportmgr.start();
			
			test.ok(!this.readyCallback.called);
			test.done();
		},
		
		"do not delegate ready event if only udp ready but not tcp" : function(test) {
			var tcpStart = sinon.collection.stub(this.tcptran, 'start');
			var udpStart = sinon.collection.stub(this.udptran, 'start', function(dataCbk, readyCbk) {
				readyCbk();
			});
			this.transportmgr.on('ready', this.readyCallback);
			
			this.transportmgr.start();
			
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
			this.transportmgr.on('ready', this.readyCallback);
			
			this.transportmgr.start(1111, '1.1.1.1');
			
			test.ok(this.readyCallback.called);
			test.done();
		}
	}),
	
	"stopping transportts" : testCase({
		setUp : function(done) {
			this.udptran = new udptran.UdpTran();
			this.tcptran = new tcptran.TcpTran();
			
			this.transportmgr = new transportmgr.TransportMgr(this.udptran, this.tcptran);
			
			this.tcpStop = sinon.collection.stub(this.tcptran, 'stop');
			this.udpStop = sinon.collection.stub(this.udptran, 'stop');
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"stop tcp transport on stop" : function(test) {
			this.transportmgr.stop();
			
			test.ok(this.tcpStop.called);
			test.done();
		},
		
		"stop udp transport on stop" : function(test) {
			this.transportmgr.stop();
			
			test.ok(this.udpStop.called);
			test.done();
		}
	}),
	
	"sending messages through given channels" : testCase({
		setUp : function(done) {
			this.udptran = new udptran.UdpTran(1234);
			this.tcptran = new tcptran.TcpTran(1234);
			this.messageparser = new messageparser.MessageParser();
			this.readyCallback = sinon.stub();
			
			this.transportmgr = new transportmgr.TransportMgr(this.udptran, this.tcptran, this.messageparser);

			this.udpSend = sinon.collection.stub(this.udptran, 'send');
			this.tcpSend = sinon.collection.stub(this.tcptran, 'send');
			this.msg = new messages.Message('p2p:myapp/myuri', {"key" : "val"});			
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should send with hop zero" : function(test) {
			sinon.stub(this.msg, 'stringify').returns('stringified');
			
			this.transportmgr.send(2222, "1.1.1.1", this.msg);
	
			test.strictEqual(2222, this.udpSend.args[0][0]);
			test.strictEqual('1.1.1.1', this.udpSend.args[0][1]);
			test.strictEqual('stringified', this.udpSend.args[0][2]);
			test.done();
		},

		"should increment hop count when sending" : function(test) {
			this.msg = new messages.Message('p2p:myapp/myuri', {"key" : "val"}, {"hops" : 11});
	
			this.transportmgr.send("1.1.1.1", 2222, this.msg);

			test.ok(/hops: 12/.test(this.udpSend.args[0][2]));
			test.done();
		},
		
		"should add port number when sending" : function(test) {
			this.transportmgr.send("1.1.1.1", 2222, this.msg);

			test.ok(/sender_port: 1234/.test(this.udpSend.args[0][2]));
			test.ok(/source_port: 1234/.test(this.udpSend.args[0][2]));
			test.done();
		},
		
		"send via udp if data size below datagram size threshold" : function(test) {			
			sinon.stub(this.msg, 'stringify').returns('stringified');
			
			this.transportmgr.send(1111, '1.1.1.1', this.msg);
			
			test.ok(this.udpSend.calledWith(1111, '1.1.1.1', "stringified"));
			test.done();
		},
		
		"send via tcp if data size above datagram size threshold" : function(test) {
			var hundred = 'ABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXY\n';
			var bigData = '';
			for (var i = 0; i < 20; i++ && (bigData = bigData.concat(hundred)));
			sinon.stub(this.msg, 'stringify').returns(bigData);			
			
			this.transportmgr.send(1111, '1.1.1.1', this.msg);
			
			test.ok(this.tcpSend.calledWith(1111, '1.1.1.1', bigData));
			test.done();
		}
	}),
	
	"receiving a message" : testCase({
		setUp : function(done) {
			this.messageparser = new messageparser.MessageParser();
			this.transportmgr = new transportmgr.TransportMgr(undefined, undefined, this.messageparser);
			
			sinon.collection.stub(this.transportmgr, 'send');
			this.rawmsg = '{"uri" : "p2p:myapp/myresource", "key" : "val"}';
			done();
		},

		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},

		"should handle unparseable message through socket" : function(test) {
			this.transportmgr.on('message', function() {test.fail('unexpected message');});			

			this.transportmgr.receiveData('badmsg', '127.0.0.1');
			
			test.done();
		},

		"should not process if no uri in message" : function(test) {
			var self = this;
			this.transportmgr.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transportmgr.receiveData('GET\n\n{"key" : "val"}', '127.0.0.1');
			}, /destination uri/i);	
			test.done();
		},
		
		"should throw if hop count over 100" : function(test) {
			var self = this;
			this.transportmgr.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transportmgr.receiveData('GET p2p:graviti/something\n' +
						'source_port : 123\n' +
						'hops : 101\n\n', '127.0.0.1');
			}, /too many hops/i);			
			test.done();
		},

		"should throw if no source port in message" : function(test) {
			var self = this;
			this.transportmgr.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transportmgr.receiveData('GET p2p:graviti/something\n\n', '1.2.3.4');
			}, /source port/i);
			test.done();
		},

		"should throw if no sender port in message" : function(test) {
			var self = this;
			this.transportmgr.on('message', function() {test.fail('unexpected message');});
			
			assert.throws(function() {
				self.transportmgr.receiveData('GET p2p:graviti/something\n'
						+ 'source_port: 123\n\n', '1.2.3.4');
			}, /sender port/i);
			test.done();
		},

		"should handle parseable message callback" : function(test) {
			// setup
			var rcvdmsg = undefined;
			var rcvdmsginfo = undefined;
			this.transportmgr.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			// act
			this.transportmgr.receiveData('GET p2p:myapp/something\n' +
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
			this.transportmgr.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			var inProgressState = this.transportmgr.receiveData('GET p2p:myapp/something\n', '6.6.6.6');
			this.transportmgr.receiveData('source_port : 1111\n' +
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
			this.transportmgr.on("message", function(msg, msginfo) {
				rcvdmsg = msg;
				rcvdmsginfo = msginfo
			});
	
			this.transportmgr.receiveData('GET p2p:myapp/something\n' +
					'source_port : 1111\n' +
					'sender_port : 2222\n\n',
				'6.6.6.6'
			);
			
			test.strictEqual('6.6.6.6', rcvdmsg.source_addr);
			test.done();
		}
	})
}