var logmgr = require('logmgr');
var logger = logmgr.getDefaultLogger();
var logrotator = require('logrotator');
var nodeunit = require('nodeunit');
var fs = require('fs');
var langutil = require('common/langutil');

module.exports = {
	"logfile rotation" : nodeunit.testCase({
		setUp : function(done) {
			var _this = this;
			
			this.origLogConf = logmgr.logConfFile || logmgr.logconf;
			this.testLogFileDir = process.env.TEMP || process.env.TMP || "/tmp";
			this.testLogFileName = "graviti-logging-integration-test.log";
			
			this.clearTestLogs = function() {
				fs.readdirSync(this.testLogFileDir).forEach(function(f) {
					if (f.indexOf(_this.testLogFileName) === 0) {
						try {
							fs.unlinkSync(_this.testLogFileDir + '/' + f);
						} catch (e) {
							logger.error('Logging integration test failed to delete ' + this.origLogConf);
						}
					}
				});				
			};
			this.clearTestLogs();

			this.testLogfilePath = this.testLogFileDir + "/" + this.testLogFileName;
			logmgr.restart({
				file : {
					filename : this.testLogfilePath,
					level : "info",
					rotateSizeKb : 1,
					rotateGenerations : 10
				}
			});

			done();
		},
		
		tearDown : function(done) {
			logmgr.restart(this.origLogConf);
			this.clearTestLogs();
			
			done();
		},
		
		"ensure no log lines are lost when we roll over" : function(test) {
			var _this = this;
			var loggedLines = [];
			var logLinesAtATime = 20;
			var numLinesToLog = 100;
			var logABit = function(line, callback) {
				if (line > numLinesToLog) {
					callback();
					return;
				}
			
				for (var i = line; i < line+logLinesAtATime; i++) {
					var msg = 'this is line [' + i + ']';
					loggedLines.push(msg);
					logmgr.getDefaultLogger().info(msg);
				}
				
				logrotator._check();

				setTimeout(function() {
					logABit(line + logLinesAtATime, callback);
				}, 100);
			};
			
			var check = function() {
				fs.readdirSync(_this.testLogFileDir).forEach(function(f) {
					if (f.indexOf(_this.testLogFileName) !== 0)
						return;
					
					fs.readFileSync(_this.testLogFileDir + '/' + f, 'utf8').split('\n').forEach(function(l) {
						loggedLines.forEach(function(loggedLine) {
							if (l.indexOf(loggedLine) > -1)	
								langutil.arrRemoveItem(loggedLines, loggedLine);
						});
					}) ;
				});

				if (loggedLines.length > 0) {
					test.fail('Some of the logged lines were not found in logfiles: ' + loggedLines);
				}
			};
			
			logABit(1, function() {
				check();
				test.done();
			});
		}
	})
};