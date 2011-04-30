var fs = require('fs');
var path = require('path');
var winston = require('winston');

var self = module.exports = {
	checkIntervalMsec : 2500,
	rotateSizeMb : 1,
	rotateGenerations : 10,
	checkIntervalId : undefined,
	filename : undefined,
	logger : undefined,
	lastSize : 0,
	lockfileSuffix : '.rotate.lock',
	lockfileAutoDeletionIntervalSec : 180,
	loggers : {},
	
	start : function(filename) {
		self.filename = filename;
		self._resetLogger();
		
		self.checkIntervalId = setInterval(self._check, self.checkIntervalMsec);
	},
	
	stop : function() {
		clearInterval(self.checkIntervalId);
	},
	
	getLogger : function(modName) {
		// make sure modName is pukka
		try {
			require(modName);
		} catch (e) {
			throw new Error('Could not create logger for unknown module ' + modName);
		}
		if (self.loggers[modName] !== undefined)
			return self.loggers[modName];
		
		var transports = [ new (winston.transports.Console)({level : 'info'}) ];
		if (self.filename) {
			transports.push(new (winston.transports.File)(
					{level : 'verbose', filename : self.filename, options : {flags : 'a'}}));	
		}
		
		var logger = new (winston.Logger) ({transports: transports});
		self.loggers[modName] = logger;
		return logger;
	},
	
	getDefaultLogger : function() {
		return winston;
	},
	
	_resetLogger : function() {
		winston.remove(winston.transports.Console);
		winston.add(winston.transports.Console, {level : 'info'});
		self.logger = winston.add(winston.transports.File, {level : 'verbose', filename : self.filename, options : {flags : 'a'}});
	},
	
	_check : function() {
		fs.stat(self.filename, function(err, logfilestat) {
			var currentLastSize = self.lastSize;
			if (err) {
				winston.error('Error doing stat on logfile ' + self.filename + ': ' + err);
				return;
			}
			
			// v small risk of this getting bigger than lastsize in < sampling interval - for now
			// having rotate sizes in mb and repeated checks as multiple files rotate should be more
			// than good enough
				fs.lstat(self.filename + self.lockfileSuffix, function(err, lockfilestat) {
					if (err) {
						if (logfilestat.size < currentLastSize)
							self._reopenLogfile();
					} else {
						var mtime = new Date(lockfilestat.mtime).getTime();
						if (mtime < (Date.now() - self.lockfileAutoDeletionIntervalSec * 1000)) {								
							winston.verbose('Auto-deleting log rotation lockfile after ' + self.lockfileAutoDeletionIntervalSec + ' sec');
							fs.unlink(self.filename + self.lockfileSuffix);
						}
					}
				});
				
			if (logfilestat.size >= self.rotateSizeMb * 1024 * 1024) {
				winston.verbose('Logfile ' + self.filename + ' needs rotating');
				fs.symlink(self.filename, self.filename + self.lockfileSuffix, function(err) {
					if (err && err.code === 'EEXIST') {
						// overtaken
						return;
					}

					self._rotate();
				});
			}
			
			self.lastSize = logfilestat.size;
		});
	},
	
	_rotate : function(index) {
		if (index === undefined)
			index = self.rotateGenerations-1;
		var currFilename = self.filename + '.' + index;
		var newFilename = self.filename + '.' + (index+1);
		
		if (index < 0) {
			fs.rename(self.filename, newFilename, function(err) {
				if (err)
					winston.error('Error renaming logfile ' + filename + ' to ' + newFilename + ': ' + err);
				self._reopenLogfile();
				fs.unlink(self.filename + self.lockfileSuffix, function(err) {
					if (err)
						winston.error('Failed to remove log rotation work-in-progress link: ' + err);
				});
			});
			return;
		}
		
		path.exists(currFilename, function(exists) {
			if (!exists) {
				self._rotate(index-1);
				return;
			}
				
			if (index === self.rotateGenerations-1) {
				fs.unlink(currFilename, function(err) {
					if (err)
						winston.error('Error removing logfile ' + currFilename + ': ' + err);
					else
						self._rotate(index-1);						
				});
			} else {
				fs.rename(currFilename, newFilename, function(err) {
					if (err)
						winston.error('Error renaming logfile ' + currFilename + ' to ' + newFilename + ': ' + err);
					else
						self._rotate(index-1);
				});
			}
		});
	},
	
	_reopenLogfile : function() {
		self.logger.transports.file.stream.destroySoon();
		var stream = fs.createWriteStream(self.filename, { flags: 'a' });
		self.logger.transports.file.stream = stream;
	}
};