var logger = require('logmgr').getLogger('pastry');
var events = require('events');
var transport = require('transport');
var leafset = require('pastry/leafset');
var routingtable = require('pastry/routingtable');
var heartbeater = require('pastry/heartbeater');
var bootstrapper = require('pastry/bootstrap');
var router = require('pastry/router');

exports.createNode = function(port, bindAddr, callback) {
	var transportStack = transport.createStack(port, bindAddr);
	var ls = new leafset.Leafset();
	var rt = new routingtable.RoutingTable();
	var hb = new heartbeater.Heartbeater(transportStack, ls, rt);
	var bs = new bootstrapper.Bootstrapper(transportStack, ls, rt, hb);
	var rutr = new router.Router(ls, rt, hb);
	transportStack.router = rutr;
	
	var node = new PastryNode(transportStack, ls, bs, hb);
	
	process.on('exit', node.stop);
	
	transportStack.start(callback);
	
	return node;
};

//
//Manages overlay membership
PastryNode = function(transport, leafset, bootstrapper, heartbeater) {
	events.EventEmitter.call(this);
	
	this.transport = transport;
	this.leafset = leafset;
	this.bootstrapper = bootstrapper;
	this.heartbeater = heartbeater;
};
util.inherits(PastryNode, events.EventEmitter);
exports.PastryNode = PastryNode;

PastryNode.prototype.startRing = function(readyCallback) {
	this.joinRing(undefined, readyCallback);
};

PastryNode.prototype.joinRing = function(bootstraps, readyCallback) {
	var self = this;
	self.leafset.on('peer-arrived', function(id) {
		self.emit('peer-arrived', id);
	});
	self.leafset.on('peer-departed', function(id) {
		self.emit('peer-departed', id);
	});

	self.bootstrapper.start(bootstraps, function() {
		if (readyCallback)
			readyCallback();
	});
	self.heartbeater.start();
	if (!bootstraps && readyCallback)
		readyCallback();
};

PastryNode.prototype.stop = function() {
	this.heartbeater.stop();
	this.bootstrapper.stop();
	this.transport.stop(); // check if this needs to be async
};