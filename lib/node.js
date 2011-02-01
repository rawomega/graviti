if (global.GENTLY) require = GENTLY.hijack(require);
var dgram = require('dgram');
var events = require('events');
var util = require('util');
var langutil = require('./langutil');
var mod_id = require('./id');

//
// Manager low-level p2p node services for use by higher framework layers.
// For instance, controls udp bindings and one-off message sends / receives.
// Emits lifecycle events.

var server = undefined;

module.exports = new events.EventEmitter();

module.exports.nodeId = undefined;	

module.exports.start = function(port, bindAddr) {
	this.nodeId = _initId();
	this.server = dgram.createSocket('udp4');
	var _this = this;
	
	this.server.on('listening', function() {
		var svraddr = _this.server.address();
		util.log('Server listening on ' + svraddr.address + ':' + svraddr.port);
	});
	
	this.server.on('message', function(content, rinfo) {
		util.log('Message from ' + rinfo.address + ':' + rinfo.port + ' : ' + content);
		var parsed;
		try {
			parsed = JSON.parse(content);
		} catch (e) {
			util.log('ERROR parsing message json: ' + msg);
			return;
		}
		
		var msg = langutil.extend(parsed, {
			sender_addr : rinfo.address,
			sender_port : rinfo.port,
			msg : parsed
		});
		_this.emit('message', msg);
	});
	this.server.bind(port, bindAddr);
};
	
module.exports.stop = function() {
	util.log('Stopping node ' + this.nodeId);
	if (this.server) {
		this.server.close();
		this.server = undefined;
	}
	this.nodeId = undefined;
};

module.exports.send = function(addr, port, msg) {
	var content = JSON.stringify(msg);
	util.log('Sending message to ' + addr + ':' + port + ' : ' + content);
	var buf = new Buffer(content);
	this.server.send(buf, 0, buf.length, port, addr);
};

function _initId() {
	// todo: get id from file if one exists
	var newId = mod_id.generateNodeId();	
	util.log('Generated new node ID ' + newId);
	return newId;
}
