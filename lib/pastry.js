var logger = require('logmgr').getLogger('pastry');
var events = require('events');
var transport = require('transport');
var leafset = require('pastry/leafset');
var routingtable = require('pastry/routingtable');
var heartbeater = require('pastry/heartbeater');
var bootstrapper = require('pastry/bootstrap');
var router = require('pastry/router');
var pns = require('pastry/pns');

exports.createNode = function(nodeId, port, bindAddr, callback) {
	var transportStack = transport.createStack(nodeId, port, bindAddr);
	var ls = new leafset.Leafset(nodeId);
	var rt = new routingtable.RoutingTable(nodeId);
	var hb = new heartbeater.Heartbeater(transportStack, ls, rt);
	var pn = new pns.Pns(transportStack, ls, rt);
	var bs = new bootstrapper.Bootstrapper(transportStack, ls, rt, hb, pn);
	var rutr = new router.Router(ls, rt, hb);
	transportStack.router = rutr;
	
	var node = new PastryNode(transportStack, ls, bs, hb);
	
	process.on('exit', node.stop.bind(node));
	
	transportStack.start(function() {
		callback(node);
	});
	
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
	
	var self = this;
	self.leafset.on('peer-arrived', function(id) {
		self.emit('peer-arrived', id);
	});
	self.leafset.on('peer-departed', function(id) {
		self.emit('peer-departed', id);
	});
	self.transport.on('app-message-forwarding', function(msg, msginfo) {
		self.emit('app-message-forwarding', msg, msginfo);
	});
	self.transport.on('app-message-received', function(msg, msginfo) {
		self.emit('app-message-received', msg, msginfo);
	});
};
util.inherits(PastryNode, events.EventEmitter);
exports.PastryNode = PastryNode;

PastryNode.prototype.startRing = function(readyCallback) {
	this.joinRing(undefined, readyCallback);
};

PastryNode.prototype.joinRing = function(bootstraps, readyCallback) {
	this.bootstrapper.start(bootstraps, function() {
		if (readyCallback)
			readyCallback();
	});
	this.heartbeater.start();
	if (!bootstraps && readyCallback)
		readyCallback();
};

PastryNode.prototype.send = function(uri, content, headers) {
	// TODO: support sending to resource only (eg '/myresource')
	this.transport.send(uri, content, headers);
};

PastryNode.prototype.reply = function(msg, uri, content, headers) {
	this.transport.sendToId(uri, content, headers, msg.source_id);
};

PastryNode.prototype.stop = function() {
	this.heartbeater.stop();
	this.bootstrapper.stop();
	// TODO: check if this needs to be async
	this.transport.stop();
};