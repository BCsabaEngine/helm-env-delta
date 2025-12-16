import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { parseConfig } from '../src/configFile';
import { executeInit, generateConfigTemplate, InitError, isInitError } from '../src/initCommand';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn()
}));

// Import mocked fs functions
import { existsSync, writeFileSync } from 'node:fs';

describe('initCommand', () => {
  describe('generateConfigTemplate', () => {
    it('should generate valid YAML', () => {
      const template = generateConfigTemplate();

      expect(() => YAML.parse(template)).not.toThrow();
    });

    it('should include required fields', () => {
      const template = generateConfigTemplate();
      const parsed = YAML.parse(template);

      expect(parsed).toHaveProperty('source');
      expect(parsed).toHaveProperty('destination');
    });

    it('should include all optional features', () => {
      const template = generateConfigTemplate();
      const parsed = YAML.parse(template);

      expect(parsed).toHaveProperty('include');
      expect(parsed).toHaveProperty('exclude');
      expect(parsed).toHaveProperty('prune');
      expect(parsed).toHaveProperty('skipPath');
      expect(parsed).toHaveProperty('outputFormat');
      expect(parsed).toHaveProperty('stopRules');
    });

    it('should include outputFormat sub-options', () => {
      const template = generateConfigTemplate();
      const parsed = YAML.parse(template);

      expect(parsed.outputFormat).toHaveProperty('indent');
      expect(parsed.outputFormat).toHaveProperty('keySeparator');
      expect(parsed.outputFormat).toHaveProperty('quoteValues');
      expect(parsed.outputFormat).toHaveProperty('keyOrders');
      expect(parsed.outputFormat).toHaveProperty('arraySort');
    });

    it('should pass schema validation', () => {
      const template = generateConfigTemplate();
      const parsed = YAML.parse(template);

      expect(() => parseConfig(parsed, 'test-config.yaml')).not.toThrow();
    });

    it('should include stopRules examples for all rule types', () => {
      const template = generateConfigTemplate();
      const parsed = YAML.parse(template);

      const allRules = Object.values(parsed.stopRules || {}).flat() as Array<{ type: string }>;
      const ruleTypes = allRules.map((rule) => rule.type);

      expect(ruleTypes).toContain('semverMajorUpgrade');
      expect(ruleTypes).toContain('semverDowngrade');
      expect(ruleTypes).toContain('numeric');
      expect(ruleTypes).toContain('regex');
    });

    it('should use placeholder paths', () => {
      const template = generateConfigTemplate();
      const parsed = YAML.parse(template);

      expect(parsed.source).toContain('./path/to/');
      expect(parsed.destination).toContain('./path/to/');
    });
  });

  describe('executeInit', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should write config to specified path', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      executeInit('./custom.yaml');

      expect(existsSync).toHaveBeenCalledWith('./custom.yaml');
      expect(writeFileSync).toHaveBeenCalledWith('./custom.yaml', expect.any(String), 'utf8');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should write to ./config.yaml by default when called with default path', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      executeInit('./config.yaml');

      expect(existsSync).toHaveBeenCalledWith('./config.yaml');
      expect(writeFileSync).toHaveBeenCalledWith('./config.yaml', expect.any(String), 'utf8');
    });

    it('should throw InitError if file already exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockImplementation(() => {});

      expect(() => executeInit('./existing.yaml')).toThrow(InitError);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should throw InitError with EEXIST code when file exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      try {
        executeInit('./existing.yaml');
        expect.fail('Should have thrown InitError');
      } catch (error) {
        expect(isInitError(error)).toBe(true);
        if (isInitError(error)) {
          expect(error.code).toBe('EEXIST');
          expect(error.path).toBe('./existing.yaml');
        }
      }
    });

    it('should throw InitError on permission denied', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const permissionError = new Error('Permission denied') as NodeJS.ErrnoException;
      permissionError.code = 'EACCES';
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw permissionError;
      });

      try {
        executeInit('./protected.yaml');
        expect.fail('Should have thrown InitError');
      } catch (error) {
        expect(isInitError(error)).toBe(true);
        if (isInitError(error)) expect(error.code).toBe('EACCES');
      }
    });

    it('should throw InitError if directory not found', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const notFoundError = new Error('Directory not found') as NodeJS.ErrnoException;
      notFoundError.code = 'ENOENT';
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw notFoundError;
      });

      try {
        executeInit('./nonexistent/dir/config.yaml');
        expect.fail('Should have thrown InitError');
      } catch (error) {
        expect(isInitError(error)).toBe(true);
        if (isInitError(error)) expect(error.code).toBe('ENOENT');
      }
    });

    it('should throw InitError if path is a directory', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const directoryError = new Error('Is a directory') as NodeJS.ErrnoException;
      directoryError.code = 'EISDIR';
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw directoryError;
      });

      try {
        executeInit('./some-directory');
        expect.fail('Should have thrown InitError');
      } catch (error) {
        expect(isInitError(error)).toBe(true);
        if (isInitError(error)) expect(error.code).toBe('EISDIR');
      }
    });

    it('should display success message after creation', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(writeFileSync).mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      executeInit('./config.yaml');

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const successMessage = calls.find((message) => message.includes('Configuration file created'));
      expect(successMessage).toBeTruthy();
      expect(successMessage).toContain('./config.yaml');
    });

    it('should write valid YAML content', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      let writtenContent = '';
      vi.mocked(writeFileSync).mockImplementation((_path, content) => {
        writtenContent = content.toString();
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      executeInit('./test.yaml');

      expect(() => YAML.parse(writtenContent)).not.toThrow();
    });
  });

  describe('InitError', () => {
    it('should format error messages correctly', () => {
      const error = new InitError('Test error', { code: 'EEXIST', path: './test.yaml' });

      expect(error.message).toContain('Init Command Error: Test error');
      expect(error.message).toContain('Path: ./test.yaml');
      expect(error.message).toContain('File already exists');
    });

    it('should include code explanations for EEXIST', () => {
      const error = new InitError('Test', { code: 'EEXIST', path: './test.yaml' });

      expect(error.message).toContain('File already exists');
    });

    it('should include code explanations for EACCES', () => {
      const error = new InitError('Test', { code: 'EACCES', path: './test.yaml' });

      expect(error.message).toContain('Permission denied');
    });

    it('should include code explanations for ENOENT', () => {
      const error = new InitError('Test', { code: 'ENOENT', path: './test.yaml' });

      expect(error.message).toContain('Directory not found');
    });

    it('should include code explanations for EISDIR', () => {
      const error = new InitError('Test', { code: 'EISDIR', path: './test.yaml' });

      expect(error.message).toContain('Path is a directory');
    });

    it('should include helpful hints', () => {
      const error = new InitError('Test error', { code: 'EEXIST', path: './test.yaml' });

      expect(error.message).toContain('Hint:');
    });

    it('should include cause details when provided', () => {
      const cause = new Error('Underlying error');
      const error = new InitError('Test error', { code: 'EEXIST', path: './test.yaml', cause });

      expect(error.message).toContain('Details: Underlying error');
    });

    it('should have correct error name', () => {
      const error = new InitError('Test', {});

      expect(error.name).toBe('Init Command Error');
    });
  });

  describe('isInitError', () => {
    it('should return true for InitError instances', () => {
      const error = new InitError('Test');

      expect(isInitError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test');

      expect(isInitError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isInitError('string')).toBe(false);
      expect(isInitError(123)).toBe(false);
      expect(isInitError({})).toBe(false);
    });
  });
});
