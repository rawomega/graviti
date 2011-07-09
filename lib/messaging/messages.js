var id = require('common/id');
var uri = require('common/uri');
var langutil = require('common/langutil');

var self = module.exports = {
	maxMessageSize : 65535,
		
	Message : function(destUri, content, headers, destId) {
		if (destUri === undefined)
			throw new Error('Missing destination uri');
			
		var node = require('core/node');
		var res = langutil.extend({
				msg_id : id.generateUuid(),
				source_id : node.nodeId,			
				created : Date.now(),
				uri : destUri,
				method : 'GET',			
				content : content,
				// TODO: correlation, transaction ids
				
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
	}
};