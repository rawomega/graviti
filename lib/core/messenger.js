var util = require('util');
var id = require('common/id');
var node = require('core/node');
var uri = require('common/uri');
var langutil = require('common/langutil');

var self = module.exports = {
	Message : function(destUri, content, headers, destId) {
		if (destUri === undefined)
			throw new Error('Missing destination uri')
			
		var node = require('core/node');
		var res = langutil.extend({
				msg_id : id.generateUuid(),
				source_id : node.nodeId,			
				created : new Date().getTime(),
				uri : destUri,
				method : 'GET',			
				content : content,
				// todo: correlation, transaction ids
				
				stringify : function() {
					var _this = this;
					var contentJson = undefined;
					if (content !== undefined)
						contentJson = JSON.stringify(content);
					
					var res = _this.method + ' ' + destUri + '\n';
					Object.keys(_this).forEach(function(header) {
						if (/^(uri|method|content)$/.test(header) || typeof(_this[header]) === 'function')
							return;
						res += header + ': ' + _this[header] + '\n';						
					});
					if (contentJson !== undefined)
						res += 'content_length: ' + contentJson.length + '\n';					
					res += '\n';
					if (contentJson !== undefined)
						res += contentJson;
					return res;
				}
			}, headers);
		if (destId !== undefined)
			res.dest_id = destId;
		return res;
	},
	
	parse : function(str) {
		var lines = str.split('\n');
		var firstLine = self._parseFirstLine(lines[0]);
		var method = firstLine.method;
		var destUri = firstLine.uri;
		var headers = {method : method};
		for (var i = 1; i < lines.length; i++) {
			var line = lines[i];
			if (line.length < 1)
				break;
			var nv = self._parseHeaderLine(line);
			if (/content_length/i.test(nv.name))
				continue;
			headers[nv.name] = nv.value;
		}
		
		var content = undefined;
		var contentStr = str.substring(str.indexOf('\n\n') + 2);		
		if (contentStr.length > 0) {			
			content = JSON.parse(contentStr);
		}
			
		return new self.Message(destUri, content, headers);
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