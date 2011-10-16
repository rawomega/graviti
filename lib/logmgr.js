var fs = require('fs');
var path = require('path');
var winston = require('winston');
var logrotator = require('logrotator');

var self = module.exports = {	
	logconf : undefined,
	loggerProxies : {},
	logConfFile : undefined,
	consoleLogger : undefined,
	fileLogger : undefined,
	fileLoggerStream : undefined,
	
	start : function(conf) {
		if (typeof(conf) === 'string') {
			self.logConfFile = conf;
			var logConfFileContent = fs.readFileSync(self.logConfFile, 'utf8');
			
			// set up watch hook so we can fix things if we screw up format etc
			fs.watchFile(self.logConfFile, { persistent: true, interval: 0 }, function(curr, prev) {
				// occasionally an event is raised for size-zero file - we ignore this as it is followed
				// by another event for the new size
				if (curr.size === 0)
					return;
				self.getDefaultLogger().info('Detected logging conf file alteration, re-initialising logging');
				self.restart();
			});

			try {
				self.logconf = JSON.parse(logConfFileContent);
			} catch (e) {
				console.log('Failed to parse log config: ' + e + '\n' + 'Log config was:\n' + logConfFileContent);
				return;
			}
		} else {
			// 'fallback' configuration
			self.logConfFile = undefined;
			self.logconf = conf;
		}

		// set up loggers for each transport
		if (self.consoleLogger)
			self.consoleLogger.remove(winston.transports.Console);
		self.consoleLogger = new winston.Logger();
		self.consoleLogger.add(winston.transports.Console, {level : 'silly'});
		
		if (self.fileLogger)
			self.fileLogger.remove(winston.transports.File);
		if (self.logconf.file && self.logconf.file.filename) {
			self._createNewFileStream();
			self.fileLogger = new winston.Logger();
			self.fileLogger.add(winston.transports.File, {level : 'silly', stream : self.fileLoggerStream});
		} else {
			self.fileLogger = undefined;
		}
		
		// reinit any existing loggers
		Object.keys(self.loggerProxies).forEach(function(loggerName) {
			delete self.loggerProxies[loggerName];
			self.getLogger(loggerName);
		});

		// lets make sure we have the default logger
		self.getDefaultLogger();
		
		if (self.fileLogger) {			
			logrotator.start(self.logconf.file, self._reopenFile, self.getDefaultLogger());
		}

        self.getDefaultLogger().verbose('Using logging configuration:\n' + JSON.stringify(self.logconf));
	},
	
	stop : function() {
		if (self.logConfFile)
			fs.unwatchFile(self.logConfFile);
		logrotator.stop();
	},
	
	restart : function(conf) {
		self.getDefaultLogger().verbose('Re-initialising loggers');
		self.stop();
		self.start(conf || self.logConfFile || self.logconf);
		self.getDefaultLogger().verbose('Re-initialised loggers');
	},
	
	_createNewFileStream : function() {
		if (self.fileLoggerStream)
			self.fileLoggerStream.destroySoon();
		self.fileLoggerStream = fs.createWriteStream(self.logconf.file.filename, { flags: 'a' });
	},
	
	_reopenFile : function() {
		if (!self.fileLogger.transports.file)
			return;
		
		self.fileLogger.transports.file.stream.destroySoon();
		
		self._createNewFileStream();
		self.fileLogger.transports.file.stream = self.fileLoggerStream;			
	},
	
	getLogger : function(modName) {
		if (self.loggerProxies[modName] !== undefined)
			return self.loggerProxies[modName];		
		
		// make sure modName is pukka
		if (modName !== 'default') {				
			try {
				require(modName);
			} catch (e) {
				throw new Error('Could not create logger for unknown module ' + modName);
			}
		}
		
		// lets make sure that every time we log, we use what's in our loggers structure.
		// that way, we can update that structure with new loggers, levels etc on the fly
		// we achieve this by returning a proxy logging object that we create here:
		var proxy = {};
		var levels = winston.levels;
		Object.keys(levels).forEach(function(level) {
			proxy[level] = function() {
				var modLevelOverride = self.logconf && self.logconf.modules && self.logconf.modules[modName];

				var consoleLevel = (self.logconf && self.logconf.console && self.logconf.console.modules && self.logconf.console.modules[modName])
						|| modLevelOverride
						|| (self.logconf && self.logconf.console && self.logconf.console.level)
						|| 'info';
				var fileLevel = (self.logconf && self.logconf.file && self.logconf.file.modules && self.logconf.file.modules[modName])
						|| modLevelOverride
						|| (self.logconf && self.logconf.file && self.logconf.file.level)
						|| 'info';
				if (levels[level] >= levels[consoleLevel])
					self.consoleLogger[level].apply(self.consoleLogger, arguments);
				if (self.fileLogger && levels[level] >= levels[fileLevel])
					self.fileLogger[level].apply(self.fileLogger, arguments);
			};
		});
		
		self.loggerProxies[modName] = proxy;
		return proxy;
	},
	
	getDefaultLogger : function() {
		return self.getLogger('default');
	}
};

// the following is insufficient
// set up exit hook
//process.on('exit', function() {
//	self.stop();
//});

// look for logging conf file
var logConfFileName = 'logconf.json';
var logConfFilePathEnvVar = 'GRAVITI_LOG_CONF_FILE';
var logConfFilePath = undefined;
if (process.env[logConfFilePathEnvVar]) {
	logConfFilePath = process.env[logConfFilePathEnvVar];
	console.log('Got log configuration path ' + logConfFilePath + ' from env variable ' + logConfFilePathEnvVar);
} else {
	var nodePath = process.env['NODE_PATH'];
	var paths = ['.'];
	if (nodePath) {	
		paths = paths.concat(nodePath.split(':'));
	}
	paths.forEach(function(p) {
		if (logConfFilePath)
			return;
		var currPath = path.join(p, logConfFileName);
		try {
			logConfFilePath = fs.realpathSync(currPath);
		} catch (e) {
			if (e.code !== 'ENOENT')
				throw e;
		}
	});
}

if (logConfFilePath) {
	self.start(logConfFilePath);
} else {
	console.log('Logging conf file ' + logConfFileName + ' not found locally, on NODE_PATH, or via ' +  logConfFilePathEnvVar + ' - defaulting to console');
	self.start({
		console :  { level : "verbose" }
	});
}
