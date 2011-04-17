var util = require('util');
var id = require('common/id');
var uri = require('common/uri');
var langutil = require('common/langutil');

var self = module.exports = {
	maxMessageSize : 65535,
		
	Message : function(destUri, content, headers, destId) {
		if (destUri === undefined)
			throw new Error('Missing destination uri')
			
		var node = require('core/node');
		var res = langutil.extend({
				msg_id : id.generateUuid(),
				source_id : node.nodeId,			
				created : Date.now(),
				uri : destUri,
				method : 'GET',			
				content : content,
				// todo: correlation, transaction ids
				
				stringify : function() {
					var _this = this;
					
					var res = _this.method + ' ' + destUri + '\n';
					Object.keys(_this).forEach(function(header) {
						if (/^(uri|method|content)$/.test(header) || typeof(_this[header]) === 'function')
							return;
						res += header + ': ' + _this[header] + '\n';						
					});
					var rawContent = undefined;
					if (content !== undefined) {
						if (_this.content_type === undefined || _this.content_type.toLowerCase() === 'application/json')
							rawContent = JSON.stringify(content);
						else
							rawContent = content;

						res += 'content_length: ' + rawContent.length + '\n';					
					}
					res += '\n';
					if (rawContent !== undefined)
						res += rawContent;
					
					if (res.length > self.maxMessageSize)
						throw new Error('Message size too big: actual ' + res.length + ', max allowed ' + self.maxMessageSize);
					return res;
				}
			}, headers);
		if (destId !== undefined)
			res.dest_id = destId;
		return res;
	},
	
	parse : function(str) {
		var parsed = self.progressiveParse(str);
		if (!parsed.headers_processed)
			throw new Error('Failed to parse headers');
		if (!parsed.content_processed)
			throw new Error('Failed to parse expected content - expected length ' + parsed.content_length + ', got ' + (parsed.unparsed_part ? parsed.unparsed_part.length : 0));
		parsed.headers['method'] = parsed.method;
		return new self.Message(parsed.uri, parsed.content, parsed.headers);
	},
	
	progressiveParse : function(str, progress) {
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
		if (self.maxMessageSize < messageSize)
			throw new Error('Message size too big: actual ' + messageSize + ', max allowed ' + self.maxMessageSize);
		
		progress.unparsed_part = (progress.unparsed_part !== undefined ? progress.unparsed_part : '') + str;
		
		self._parseMethodAndUri(progress);
		self._parseHeaders(progress);
		self._parseContent(progress);
				
		self._clearOutEmptyUnparsedPart(progress);
		return progress;
	},
	
	_parseMethodAndUri : function(progress) {		
		if (progress.method === undefined) {
			var breakIdx = progress.unparsed_part.indexOf('\n');
			if (breakIdx < 0) {
				self._clearOutEmptyUnparsedPart(progress);
				return progress;
			}
			var firstLine = self._parseFirstLine(progress.unparsed_part.substring(0, breakIdx));
			progress.method = firstLine.method;			
			progress.uri = firstLine.uri;
			progress.unparsed_part = progress.unparsed_part.substring(1+breakIdx);
		}
	},
	
	_parseHeaders : function(progress) {
		if (!progress.headers_processed) {
			var headerBreakIdx = progress.unparsed_part.indexOf('\n');
			if (headerBreakIdx < 0) {
				self._clearOutEmptyUnparsedPart(progress);
				return progress;
			}

			while(progress.unparsed_part.indexOf('\n') > -1) {
				headerBreakIdx = progress.unparsed_part.indexOf('\n');
				var headerLine = progress.unparsed_part.substring(0, headerBreakIdx);
				if (headerLine.length < 1) {
					progress.headers_processed = true;
					progress.unparsed_part = progress.unparsed_part.substring(1);
					break;
				}

				var nv = self._parseHeaderLine(headerLine);
				if (/content_length/i.test(nv.name)) {
					progress.content_length = nv.value;
				} else {
					progress.headers[nv.name] = nv.value;					
				}
				progress.unparsed_part = progress.unparsed_part.substring(1+headerBreakIdx);
			}
		}
	},
	
	_parseContent : function(progress) {
		if (progress.content_length > 0) {
			if (progress.unparsed_part.length < progress.content_length) {
				self._clearOutEmptyUnparsedPart(progress);				
				return progress;
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
	},
	
	_clearOutEmptyUnparsedPart: function(progress) {
		progress.unparsed_part = (progress.unparsed_part !== undefined && progress.unparsed_part.length > 0)
			? progress.unparsed_part : undefined;
	},
	
	_parseFirstLine : function(str) {
		var tokens = str.trim().split(/[\s\t]+/);
		
		var method = tokens[0].trim().toUpperCase();
		if (!/(GET|PUT|POST|DELETE)/.test(method))
			throw new Error('Unsupported method: ' + tokens[0]);
		
		if (tokens.length < 2)
			throw new Error('Missing destination uri');
		
		var uri = tokens[tokens.length-1].trim();
		return {
			method : method,
			uri : uri
		};
	},
	
	_parseHeaderLine : function(str) {
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
};