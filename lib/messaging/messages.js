var id = require('common/id');
var uri = require('common/uri');
var langutil = require('common/langutil');
var node = require('core/node');

exports.maxMessageSize = 65535;

Message = function(destUri, content, headers, destId) {
	if (destUri === undefined)
		throw new Error('Missing destination uri');

	this.msg_id = id.generateUuid();
	this.source_id = node.nodeId;		
	this.created = Date.now();
	this.uri = destUri;
	this.method = 'GET';			
	this.content = content;
	if (destId !== undefined)
		this.dest_id = destId;
	
	var self = this;
	if (headers)
		Object.keys(headers).forEach(function(header) {
			self[header] = headers[header];
		});
};

Message.prototype.stringify = function() {
	var self = this;
	
	var res = self.method + ' ' + this.uri + '\n';
	Object.keys(self).forEach(function(header) {
		if (/^(uri|method|content)$/.test(header) || typeof(self[header]) === 'function')
			return;
		res += header + ': ' + self[header] + '\n';						
	});
	var rawContent = undefined;
	if (self.content !== undefined) {
		if (self.content_type === undefined || self.content_type.toLowerCase() === 'application/json')
			rawContent = JSON.stringify(self.content);
		else
			rawContent = self.content;
		
		res += 'content_length: ' + rawContent.length + '\n';					
	}
	res += '\n';
	if (rawContent !== undefined)
		res += rawContent;
	
	if (res.length > exports.maxMessageSize)
		throw new Error('Message size too big: actual ' + res.length + ', max allowed ' + exports.maxMessageSize);
	return res;
}

Ack = function(msgId) {
	this.msg_id = msgId;
	this.method = 'ACK';
};

Ack.prototype.stringify = function() {
	return 'ACK ' + this.msg_id;
};

exports.Message = Message;
exports.Ack = Ack;