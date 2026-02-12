import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger } from '../src/logger';
import { StopRuleViolation } from '../src/pipeline/stopRulesValidator';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('shouldShow', () => {
    it('should always show critical messages in all verbosity levels', () => {
      const quietLogger = new Logger({ level: 'quiet', isDiffJson: false });
      const normalLogger = new Logger({ level: 'normal', isDiffJson: false });
      const verboseLogger = new Logger({ level: 'verbose', isDiffJson: false });

      expect(quietLogger.shouldShow('critical')).toBe(true);
      expect(normalLogger.shouldShow('critical')).toBe(true);
      expect(verboseLogger.shouldShow('critical')).toBe(true);
    });

    it('should always show special (machine-readable) messages in all verbosity levels', () => {
      const quietLogger = new Logger({ level: 'quiet', isDiffJson: false });
      const normalLogger = new Logger({ level: 'normal', isDiffJson: false });
      const verboseLogger = new Logger({ level: 'verbose', isDiffJson: false });

      expect(quietLogger.shouldShow('special')).toBe(true);
      expect(normalLogger.shouldShow('special')).toBe(true);
      expect(verboseLogger.shouldShow('special')).toBe(true);
    });

    it('should show normal messages only in normal and verbose levels', () => {
      const quietLogger = new Logger({ level: 'quiet', isDiffJson: false });
      const normalLogger = new Logger({ level: 'normal', isDiffJson: false });
      const verboseLogger = new Logger({ level: 'verbose', isDiffJson: false });

      expect(quietLogger.shouldShow('normal')).toBe(false);
      expect(normalLogger.shouldShow('normal')).toBe(true);
      expect(verboseLogger.shouldShow('normal')).toBe(true);
    });

    it('should show debug messages only in verbose level', () => {
      const quietLogger = new Logger({ level: 'quiet', isDiffJson: false });
      const normalLogger = new Logger({ level: 'normal', isDiffJson: false });
      const verboseLogger = new Logger({ level: 'verbose', isDiffJson: false });

      expect(quietLogger.shouldShow('debug')).toBe(false);
      expect(normalLogger.shouldShow('debug')).toBe(false);
      expect(verboseLogger.shouldShow('debug')).toBe(true);
    });
  });

  describe('log', () => {
    it('should output normal messages in normal mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.log('test message', 'normal');

      expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });

    it('should suppress normal messages in quiet mode', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.log('test message', 'normal');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should output critical messages in quiet mode', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.log('critical message', 'critical');

      expect(consoleLogSpy).toHaveBeenCalledWith('critical message');
    });

    it('should default to normal category if not specified', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.log('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });
  });

  describe('warn', () => {
    it('should output warnings in normal mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.warn('warning message', 'normal');

      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
    });

    it('should suppress warnings in quiet mode (normal category)', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.warn('warning message', 'normal');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should output critical warnings in quiet mode', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.warn('critical warning', 'critical');

      expect(consoleWarnSpy).toHaveBeenCalledWith('critical warning');
    });
  });

  describe('error', () => {
    it('should always output errors (defaults to critical)', () => {
      const quietLogger = new Logger({ level: 'quiet', isDiffJson: false });
      const normalLogger = new Logger({ level: 'normal', isDiffJson: false });

      quietLogger.error('error message');
      normalLogger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should respect category parameter', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.error('normal error', 'normal');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should output debug messages in verbose mode', () => {
      const logger = new Logger({ level: 'verbose', isDiffJson: false });
      logger.debug('debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith('debug message');
    });

    it('should suppress debug messages in normal mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.debug('debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should suppress debug messages in quiet mode', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.debug('debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('progress', () => {
    it('should output progress messages in normal mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.progress('Loading...', 'loading');

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Loading...');
    });

    it('should suppress progress messages in quiet mode', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.progress('Loading...', 'loading');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('fileOp', () => {
    it('should output file operations in normal mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.fileOp('add', 'test.yaml', false);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test.yaml');
    });

    it('should suppress file operations in quiet mode', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.fileOp('add', 'test.yaml', false);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle dry-run mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.fileOp('update', 'test.yaml', true);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('DRY RUN');
    });

    it('should handle already deleted files', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.fileOp('delete', 'test.yaml', false, true);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('already deleted');
    });
  });

  describe('stopRule', () => {
    const mockViolation: StopRuleViolation = {
      file: 'test.yaml',
      path: '$.version',
      rule: { type: 'semverMajorUpgrade' },
      message: 'Version upgrade detected',
      oldValue: '1.0.0',
      updatedValue: '2.0.0'
    };

    it('should output stop rule violations as errors in error mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.stopRule(mockViolation, 'error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Stop Rule Violation');
    });

    it('should output stop rule violations as warnings in warning mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.stopRule(mockViolation, 'warning');

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Dry Run');
    });

    it('should output stop rule violations as warnings in force mode', () => {
      const logger = new Logger({ level: 'normal', isDiffJson: false });
      logger.stopRule(mockViolation, 'force');

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('--force');
    });

    it('should output stop rule violations even in quiet mode (critical)', () => {
      const logger = new Logger({ level: 'quiet', isDiffJson: false });
      logger.stopRule(mockViolation, 'error');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('JSON output flag', () => {
    it('should not affect shouldShow logic', () => {
      const loggerWithJson = new Logger({ level: 'normal', isDiffJson: true });
      const loggerWithoutJson = new Logger({ level: 'normal', isDiffJson: false });

      expect(loggerWithJson.shouldShow('normal')).toBe(loggerWithoutJson.shouldShow('normal'));
      expect(loggerWithJson.shouldShow('debug')).toBe(loggerWithoutJson.shouldShow('debug'));
      expect(loggerWithJson.shouldShow('critical')).toBe(loggerWithoutJson.shouldShow('critical'));
    });
  });
});
