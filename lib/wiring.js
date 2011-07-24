var port = ...;
var bindAddr = ...;

var node = new require('core/node').Node();


var leafset = new require('overlay/pastry/leafset').Leafset();
var routingtable = new require('overlay/routingtable').RoutingTable();
var pns = new require('overlay/pastry/pns').Pns(messageMgr, leafset, routingtable);
var pnsRunner = new require('overlay/pastry/pnsrunner').PnsRunner(pns);
var heartbeater = new require('overlay/pastry/heartbeater').Heartbeater(messageMgr, leafset, routingtable);
var bootstrapMgr = new require('overlay/pastry/bootstrapmgr').BootstrapMgr(messageMgr, leafset, routingtable, heartbeater, pnsRunner);
var routingMgr = new require('overlay/pastry/routingmgr').RoutingMgr(leafset, routingtable, heartbeater);
messageMgr.router = routingMgr;
var overlay = new require('overlay/pastry/overlay').Overlay(leafset, bootstrapMgr, heartbeater);

var appMgr = new require('core/appmgr').AppMgr(messageMgr, overlay);
var ring = new require('api/ring').Ring(overlay, appMgr);