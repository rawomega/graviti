var logger = require('logmgr').getLogger('overlay/pastry/overlay');
var node = require('core/node');
var uri = require('common/uri');
var langutil = require('common/langutil');
var bootstrapmgr = require('overlay/pastry/bootstrapmgr');
var heartbeater = require('overlay/pastry/heartbeater');
var leafset = require('overlay/pastry/leafset');
var routingmgr = require('overlay/pastry/routingmgr');
var routingtable = require('overlay/routingtable');
var messages = require('messaging/messages');
var transportmgr = require('messaging/transportmgr');

//
// Manages overlay membership
var self = module.exports = {
	join : function(port, bindAddr, bootstraps, emitter, readyCallback) {
		leafset.on('peer-arrived', function(id) {
			emitter.emit('peer-arrived', id);
		});
		leafset.on('peer-departed', function(id) {
			emitter.emit('peer-departed', id);
		});
		bootstrapmgr.on("bootstrap-completed", function() {
			if (readyCallback)
				readyCallback();
		});

		bootstrapmgr.start(self, bootstraps);
		heartbeater.start(self);
		if (!bootstraps)
			readyCallback();
	},

	stop : function() {
		bootstrapmgr.stop();
		heartbeater.stop();
	},
	
	//
	// Handle a received message, or an outbound message about to leave this node,
	// and decide what to do with it. If the message is for this node, we raise an event.
	// If it is for a remote node, we raise a forwarding event, letting app logic alter it
	_processMessage : function(msg, msginfo, emitter) {
		// figure out if this message is for us
		var isForThisNode = true;
		var nextHop = undefined;
		if (msg.dest_id !== undefined && msg.dest_id.length > 0) {			
			nextHop = routingmgr.getNextHop(msg.dest_id);
			if (nextHop.id !== node.nodeId) {
				logger.verbose((msg.source_id === node.nodeId ? 'Outbound' : 'En route') + ' forwarding message ' + msg.msg_id + ' to ' + msg.dest_id);
				isForThisNode = false;
			}
		}

		// if is for me, emit received, else emit forward
		if (isForThisNode) {
			logger.verbose('message for this node: uri ' + msg.uri + ', source ' + msg.source_id);
			if (msginfo.app_name === 'graviti') {
				emitter.emit('graviti-message-received', msg, msginfo);
			} else {				
				emitter.emit(msginfo.app_name + '-app-message-received', msg, msginfo);
			}
		} else {
			msginfo = langutil.extend(msginfo, {
				next_hop_id   : nextHop.id,
				next_hop_addr : nextHop.addr,
				next_hop_port : nextHop.port
			});
			if (msginfo.app_name === 'graviti') {
				emitter.emit('graviti-message-forwarding', msg, msginfo);
			} else {
				emitter.emit(msginfo.app_name + '-app-message-forwarding', msg, msginfo);
			}
			transportmgr.send(msginfo.next_hop_port, msginfo.next_hop_addr, msg);
			
			// let's see if we can offer the sender a better route to help it lazily repair its
			// routing table (PNS paper, sect 3.2)
			if (msg.source_id !== node.nodeId) {				
				var betterRoute = routingtable.findBetterRoutingHop(msg.source_id, msg.dest_id);
				if (betterRoute !== undefined) {
					logger.verbose('Found better route (' + betterRoute.id + ') for message from ' + msg.source_id + ' to ' + msg.dest_id + ', going to offer it back');
					var ap = msginfo.source_ap.split(':');
					var content = {
							routing_table : betterRoute.row
					};		
					heartbeater.sendHeartbeatToAddr(ap[0], ap[1], content);
				}
			}
		}
	}
};