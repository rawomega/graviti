var fs = require('fs');
var winston = require('winston');
var logrotator = require('logrotator');

var self = module.exports = {	
	logger : undefined,
	logconf : undefined,
	loggerProxies : {},
	logConfFile : undefined,
	consoleLogger : undefined,
	fileLogger : undefined,
	fileLoggerStream : undefined,
	
	start : function(logConfFile) {
		self.logConfFile = logConfFile;
		var logConfFileContent = fs.readFileSync(logConfFile, 'utf8');
		
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

		// set up loggers for each transport
		self._ensureLoggers();
		
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

		self.getDefaultLogger().info('Read logging configuration:\n' + logConfFileContent);
	},
	
	stop : function() {
		fs.unwatchFile(self.logConfFile);
		logrotator.stop();
		self.consoleLogger.remove(winston.transports.Console);
		self.fileLogger.remove(winston.transports.File);
//		self.consoleLogger = undefined;
//		self.fileLogger = undefined;
	},
	
	restart : function() {
		self.getDefaultLogger().info('Re-initialising loggers');
		self.stop();
		self.start(self.logConfFile);
		self.getDefaultLogger().info('Re-initialised loggers');
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
	
	_ensureLoggers : function() {
		if (self.consoleLogger === undefined) {
			self.consoleLogger = new winston.Logger();
			self.consoleLogger.add(winston.transports.Console, {level : 'silly'});			
		}
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

		self._ensureLoggers();
		
		// lets make sure that every time we log, we use what's in our loggers structure.
		// that way, we can update that structure with new loggers, levels etc on the fly
		// we achieve this by returning a proxy logging object that we create here:
		var proxy = {};
		var levels = winston.levels;
		Object.keys(levels).forEach(function(level) {
			proxy[level] = function() {
				var consoleLevel = (self.logconf && self.logconf.console && self.logconf.console.level) || 'info';
				var fileLevel = (self.logconf && self.logconf.file && self.logconf.file.level) || 'info';
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