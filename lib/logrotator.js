var fs = require('fs');
var path = require('path');
var logger = undefined;	// set lazily in start

var self = module.exports = {
	filename : undefined,
	checkIntervalMsec : 2500,
	checkIntervalId : undefined,
	rotateSizeKb : undefined,
	rotateGenerations : undefined,
	defaultRotateSizeKb : 1024,
	defaultRotateGenerations : 10,
	lastSize : 0,
	lockfileSuffix : '.rotate.lock',
	lockfileAutoDeletionIntervalSec : 180,
	reopenFileCallback : undefined,
	
	start : function(opts, reopenFileCallback, defaultLogger) {
		logger = defaultLogger;
		
		self.filename = opts.filename;
		self.rotateSizeKb = opts.rotateSizeKb || self.defaultRotateSizeKb;
		self.rotateGenerations = opts.rotateGenerations || self.defaultRotateGenerations;
		self.reopenFileCallback = reopenFileCallback;
		self.checkIntervalId = setInterval(self._check, self.checkIntervalMsec);
	},
		
	stop : function() {
		clearInterval(self.checkIntervalId);
	},

	_check : function() {		
		fs.stat(self.filename, function(err, logfilestat) {
			var currentLastSize = self.lastSize;
			if (err) {
				logger.error('Error doing stat on logfile ' + self.filename + ': ' + err);
				return;
			}

			// v small risk of this getting bigger than lastsize in < sampling interval - for now
			// having rotate sizes in mb and repeated checks as multiple files rotate should be more
			// than good enough
			fs.lstat(self.filename + self.lockfileSuffix, function(err, lockfilestat) {
				if (err) {
					if (logfilestat.size < currentLastSize)
						self.reopenFileCallback();
				} else {
					var mtime = new Date(lockfilestat.mtime).getTime();
					if (mtime < (Date.now() - self.lockfileAutoDeletionIntervalSec * 1000)) {								
						logger.verbose('Auto-deleting log rotation lockfile after ' + self.lockfileAutoDeletionIntervalSec + ' sec');
						fs.unlink(self.filename + self.lockfileSuffix);
					}
				}
			});
			
			if (logfilestat.size >= self.rotateSizeKb * 1024) {
				logger.verbose('Logfile ' + self.filename + ' needs rotating');
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
					logger.error('Error renaming logfile ' + self.filename + ' to ' + newFilename + ': ' + err);
				self.reopenFileCallback();
				fs.unlink(self.filename + self.lockfileSuffix, function(err) {
					if (err)
						logger.error('Failed to remove log rotation work-in-progress link: ' + err);
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
						logger.error('Error removing logfile ' + currFilename + ': ' + err);
					else
						self._rotate(index-1);
				});
			} else {
				fs.rename(currFilename, newFilename, function(err) {
					if (err)
						logger.error('Error renaming logfile ' + currFilename + ' to ' + newFilename + ': ' + err);
					else
						self._rotate(index-1);
				});
			}
		});
	}
};