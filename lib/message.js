var langutil = require('langutil');
var ringutil = require('ringutil');
var node = require('core/node');

exports.maxMessageSize = 65535;

function Message(destUri, content, headers, destId) {
	if (destUri === undefined)
		throw new Error('Missing destination uri');

	this.msg_id = ringutil.generateUuid();
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
}
exports.Message = Message;

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
};

function Ack(msgId) {
	this.msg_id = msgId;
	this.method = 'ACK';
}
exports.Ack = Ack;

Ack.prototype.stringify = function() {
	return 'ACK ' + this.msg_id;
};

exports.parse = function(str) {
	var parsed = this.progressiveParse(str);
	if (!parsed.headers_processed)
		throw new Error('Failed to parse headers');
	if (!parsed.content_processed)
		throw new Error('Failed to parse expected content - expected length ' + parsed.content_length + ', got ' + (parsed.unparsed_part ? parsed.unparsed_part.length : 0));
	parsed.headers['method'] = parsed.method;
	return new Message(parsed.uri, parsed.content, parsed.headers);
};
	
exports.parseAck = function(str) {
	var m = /^ACK\s+(\S+)$/(str);

	if (!m)
		return undefined;
	return new Ack(m[1]);
};
	
exports.progressiveParse = function(str, progress) {
	if (progress === undefined) {			
		progress = {
			headers : {},
			headers_processed : false,
			content_processed : false,
			content_length : 0
		};
	} else {
		progress = langutil.extend({}, progress);
		progress.headers = langutil.extend({}, progress.headers);
	}
	
	var messageSize = (progress.unparsed_part === undefined ? 0 : progress.unparsed_part.length) + str.length;
	if (exports.maxMessageSize < messageSize)
		throw new Error('Message size too big: actual ' + messageSize + ', max allowed ' + exports.maxMessageSize);
	
	progress.unparsed_part = (progress.unparsed_part !== undefined ? progress.unparsed_part : '') + str;
	
	_parseMethodAndUri(progress);
	_parseHeaders(progress);
	_parseContent(progress);
			
	_clearOutEmptyUnparsedPart(progress);
	return progress;
};

function _parseMethodAndUri(progress) {		
	if (progress.method === undefined) {
		var breakIdx = progress.unparsed_part.indexOf('\n');
		if (breakIdx < 0) {
			_clearOutEmptyUnparsedPart(progress);
			return;
		}
		var firstLine = _parseFirstLine(progress.unparsed_part.substring(0, breakIdx));
		progress.method = firstLine.method;			
		progress.uri = firstLine.uri;
		progress.unparsed_part = progress.unparsed_part.substring(1+breakIdx);
	}
}

function _parseHeaders(progress) {
	if (!progress.headers_processed) {
		var headerBreakIdx = progress.unparsed_part.indexOf('\n');
		if (headerBreakIdx < 0) {
			_clearOutEmptyUnparsedPart(progress);
			return;
		}

		while(progress.unparsed_part.indexOf('\n') > -1) {
			headerBreakIdx = progress.unparsed_part.indexOf('\n');
			var headerLine = progress.unparsed_part.substring(0, headerBreakIdx);
			if (headerLine.length < 1) {
				progress.headers_processed = true;
				progress.unparsed_part = progress.unparsed_part.substring(1);
				break;
			}

			var nv = _parseHeaderLine(headerLine);
			if (/content_length/i.test(nv.name)) {
				progress.content_length = nv.value;
			} else {
				progress.headers[nv.name] = nv.value;					
			}
			progress.unparsed_part = progress.unparsed_part.substring(1+headerBreakIdx);
		}
	}
}

function _parseContent(progress) {
	if (progress.content_length > 0) {
		if (progress.unparsed_part.length < progress.content_length) {
			_clearOutEmptyUnparsedPart(progress);				
			return;
		} else {
			if (progress.headers.content_type === undefined || progress.headers.content_type.toLowerCase() === 'application/json')
				try {
					progress.content = JSON.parse(progress.unparsed_part);
				} catch (e) {
					throw new Error('Could not parse JSON content: ' + e);
				}
			else
				progress.content = progress.unparsed_part;
			progress.content_processed = true;
			progress.unparsed_part = undefined;
		}
	} else if (progress.headers_processed){
		progress.content_processed = true;
	}
}

function _clearOutEmptyUnparsedPart(progress) {
	progress.unparsed_part = (progress.unparsed_part !== undefined && progress.unparsed_part.length > 0)
		? progress.unparsed_part : undefined;
}

function _parseFirstLine(str) {
	var tokens = str.trim().split(/[\s\t]+/);
	
	var method = tokens[0].trim().toUpperCase();
	if (! (/(GET|PUT|POST|DELETE)/).test(method))
		throw new Error('Unsupported method: ' + tokens[0]);
	
	if (tokens.length < 2)
		throw new Error('Missing destination uri');
	
	var uri = tokens[tokens.length-1].trim();
	return {
		method : method,
		uri : uri
	};
}

function _parseHeaderLine(str) {
	var colonIdx = str.indexOf(':');
	if (colonIdx < 0)
		throw new Error('Bad header: ' + str);
	var name = str.substring(0, colonIdx).trim();
	if (name.length < 1)
		throw new Error('Bad header name: ' + str);
	var value  = str.substring(colonIdx + 1).trim();
	if (value.length < 1)
		throw new Error('Bad header value: ' + str);
	return {
		name : name,
		value : value
	};
}