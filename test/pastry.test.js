var assert = require('assert');
var sinon = require('sinon');
var langutil = require('langutil');
var leafset = require('pastry/leafset');
var bootstrap = require('pastry/bootstrap');
var heartbeater = require('pastry/heartbeater');
var transport = require('transport');
var pastry = require('pastry');
var mockutil = require('testability/mockutil');
var testCase = require('nodeunit').testCase;

var nodeId = 'ABCDEF';

module.exports = {
	"should create a pastry node and its deps" : testCase({
		setUp : function(done) {
			sinon.collection.stub(Function.prototype, 'bind', function() { return this; });
			this.processOn = sinon.collection.stub(process, 'on');			
			
			this.transportStack = mockutil.stubProto(transport.TransportStack);
			this.createStack = sinon.collection.stub(transport, 'createStack').returns(this.transportStack);
			this.cbk = sinon.stub();
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should create a good node object" : function(test) {
			var res = pastry.createNode(nodeId, 1111, '1.1.1.1', this.cbk);
			
			test.ok(this.createStack.calledWith(nodeId, 1111, '1.1.1.1'));
			test.ok(res.leafset !== undefined);
			test.ok(res.leafset.nodeId === nodeId);
			test.ok(res.transport === this.transportStack);
			test.ok(res.bootstrapper.routingtable.nodeId === nodeId);
			test.ok(res.bootstrapper !== undefined);
			test.ok(res.bootstrapper.pns !== undefined);
			test.ok(res.heartbeater !== undefined);			
			test.done();
		},
		
		"should set router for transport stack and start stack" : function(test) {
			var transportStart = sinon.stub(this.transportStack, 'start');
			
			var res = pastry.createNode(nodeId, 1111, '1.1.1.1', this.cbk);

			test.ok(res.transport.router !== undefined);
			test.ok(transportStart.calledWith(this.cbk));
			test.done();
		},
		
		"should create process exit handler to stop" : function(test) {
			var res = pastry.createNode(nodeId, 1111, '1.1.1.1', this.cbk);

			test.ok(this.processOn.calledWith('exit', res.stop));
			test.done();
		}
	}),

	"stopping a pastry node" : testCase({
		setUp : function(done) {
			this.transport = mockutil.stubProto(transport.TransportStack);
			this.bootstrapper = mockutil.stubProto(bootstrap.Bootstrapper);
			this.heartbeater = mockutil.stubProto(heartbeater.Heartbeater);
			this.leafset = new leafset.Leafset();
			this.pastryNode = new pastry.PastryNode(this.transport, this.leafset, this.bootstrapper, this.heartbeater);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should stop things we started" : function(test) {
			this.bootstrapperStop = sinon.stub(this.bootstrapper, 'stop');
			this.heartbeaterStop = sinon.stub(this.heartbeater, 'stop');
			this.transportStop = sinon.stub(this.transport, 'stop');
			
			this.pastryNode.stop();
			
			test.ok(this.bootstrapperStop.called);
			test.ok(this.heartbeaterStop.called);
			test.ok(this.transportStop.called);
			test.done();
		}
	}),

	"staring and joining a pastry ring" : testCase({
		setUp : function(done) {
			this.transport = new events.EventEmitter();
			this.bootstrapper = mockutil.stubProto(bootstrap.Bootstrapper);
			this.heartbeater = mockutil.stubProto(heartbeater.Heartbeater);
			this.leafset = new leafset.Leafset();
			this.bootstrapStart = sinon.stub(this.bootstrapper, 'start', function(bootstraps, cbk) {
				cbk();
			});
			this.heartbeaterStart = sinon.stub(this.heartbeater, 'start');			
			this.callback = sinon.stub();
			
			this.pastryNode = new pastry.PastryNode(this.transport, this.leafset, this.bootstrapper, this.heartbeater);
			done();
		},
		
		tearDown : function(done) {
			sinon.collection.restore();
			done();
		},
		
		"should start node when starting new ring" : function(test) {
			this.pastryNode.startRing(this.callback);
				
			test.ok(this.bootstrapStart.called);
			test.ok(this.heartbeaterStart.calledWith());
			test.ok(this.callback.called);
			test.done();
		},

		"should start node and initiate bootstrapping when joining an existing ring" : function(test) {
			this.pastryNode.joinRing('127.0.0.1:4567', this.callback);
			
			test.ok(this.bootstrapStart.calledWith('127.0.0.1:4567'));
			test.ok(this.heartbeaterStart.calledWith());
			test.ok(this.callback.called);
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has started a new ring" : function(test) {
			this.pastryNode.startRing(this.callback);
			this.pastryNode.on('peer-arrived', this.callback);
			
			this.leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer departed event for node leaving the ring, when this node has started a new ring" : function(test) {
			this.pastryNode.startRing(this.callback);
			this.pastryNode.on('peer-departed', this.callback);
			
			this.leafset.emit('peer-departed', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit peer arrived event for node joining the ring, when this node has joined an existing ring" : function(test) {
			this.pastryNode.joinRing(undefined, this.callback);
			this.pastryNode.on('peer-arrived', this.callback);
			
			this.leafset.emit('peer-arrived', 'ABCDEF');
			
			test.ok(this.callback.calledWith('ABCDEF'));
			test.done();
		},
		
		"should re-emit app message forwarding events" : function(test) {
			var msg = 'msg';
			var msginfo = 'msginfo';			
			this.pastryNode.on('app-message-forwarding', this.callback);			
			
			this.transport.emit('app-message-forwarding', msg, msginfo);
			
			test.ok(this.callback.calledWith(msg, msginfo));
			test.done();
		},
		
		"should re-emit app message received events" : function(test) {
			var msg = 'msg';
			var msginfo = 'msginfo';			
			this.pastryNode.on('app-message-received', this.callback);			
			
			this.transport.emit('app-message-received', msg, msginfo);
			
			test.ok(this.callback.calledWith(msg, msginfo));
			test.done();
		}
	}),
	
	"sending messages" : testCase({
		setUp : function(done) {
			this.transport = mockutil.stubProto(transport.TransportStack);
			this.leafset = new leafset.Leafset();
			this.pastryNode = new pastry.PastryNode(this.transport, this.leafset);
			done();
		},
		
		"send a messages" : function(test) {
			var transportSend = sinon.stub(this.transport, 'send');
			
			this.pastryNode.send('uri', 'content', 'headers');
			
			test.ok(transportSend.calledWith('uri', 'content', 'headers'));
			test.done();
		},
		
		"reply to a messages" : function(test) {
			var transportSendToId = sinon.stub(this.transport, 'sendToId');
			
			this.pastryNode.reply( {source_id : 'source_id'}, 'uri', 'content', 'headers');
			
			test.ok(transportSendToId.calledWith('uri', 'content', 'headers', 'source_id'));
			test.done();
		}
	})
};