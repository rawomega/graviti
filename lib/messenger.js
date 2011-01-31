
//
// Provides a best-effort messaging service to p2p applications
module.exports = {
		send : function(destUri, content, opts) {
			var defs = {
				method: 'GET',
				resend_until_ack : true,
				resend_timeout_sec : 60,
				resend_initial_delay_msec : 1000,
				resend_backoff_factor : 100
			};
			var options = Object.create(defs, opts);
		
			var msg = {
				msg_id : mod_id.generateUuid(),
				source : this.nodeId,
				dest : dest,
				created : new Date().getTime(),
				method : options.method,
				resource : resource,
				content : content
				// todo: correlation, transaction ids
			};
		
			// todo: add to send queue, manage retries, timeouts, resp / ack correlation
			console.log('Sending message: ' + JSON.stringify(msg));
			var buf = new Buffer(msg);
			this.server.send(buf, 0, buf.length, destPort, destHost);
		}
};