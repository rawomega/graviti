var port = ...;
var bindAddr = ...;

var node = new require('core/node').Node();

var udpTran = new require('messaging/tcptran').UdpTran(port, bindAddr);
var tcpTran = new require('messaging/tcptran').TcpTran(port, bindAddr);
var messageParser = new require('messaging/messageparser').MessageParser();
var transportMgr = new require('messaging/transportmgr').TransportMgr(udpTran, tcpTran, messageParser);
var messageMgr = new require('messaging/messagemgr').MessageMgr(transportMgr);

var leafset = new require('overlay/pastry/leafset').Leafset();
var routingtable = new require('overlay/routingtable').RoutingTable();
var pns = new require('overlay/pastry/pns').Pns(overlay);	// TODO: cyclic
var pnsRunner = new require('overlay/pastry/pnsrunner').PnsRunner(pns);
var heartbeater = new require('overlay/pastry/heartbeater').Heartbeater(messageMgr, leafset, routingtable);
var bootstrapMgr = new require('overlay/pastry/bootstrapmgr').BootstrapMgr(messageMgr, leafset, routingtable, heartbeater, pnsRunner);
var routingMgr = new require('overlay/pastry/routingmgr').RoutingMgr(leafset, routingtable, heartbeater);
messageMgr.router = routingMgr;