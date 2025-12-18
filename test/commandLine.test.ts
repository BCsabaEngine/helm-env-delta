import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseCommandLine } from '../src/commandLine';

describe('commandLine', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sync command', () => {
    it('should parse sync command with --config flag', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml']);

      expect(result).toEqual({
        command: 'sync',
        config: 'test.yaml',
        dryRun: false,
        force: false,
        diff: false,
        diffHtml: false,
        diffJson: false
      });
    });

    it('should parse sync command with -c short flag', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '-c', 'config.yaml']);

      expect(result.command).toBe('sync');
      if (result.command === 'sync') expect(result.config).toBe('config.yaml');
    });

    it('should parse sync command with --dry-run', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--dry-run']);

      if (result.command === 'sync') {
        expect(result.dryRun).toBe(true);
        expect(result.force).toBe(false);
      }
    });

    it('should parse sync command with --force', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--force']);

      if (result.command === 'sync') {
        expect(result.force).toBe(true);
        expect(result.dryRun).toBe(false);
      }
    });

    it('should parse sync command with --diff', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--diff']);

      if (result.command === 'sync') expect(result.diff).toBe(true);
    });

    it('should parse sync command with --diff-html', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--diff-html']);

      if (result.command === 'sync') expect(result.diffHtml).toBe(true);
    });

    it('should parse sync command with --diff-json', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--diff-json']);

      if (result.command === 'sync') expect(result.diffJson).toBe(true);
    });

    it('should parse sync command with all flags combined', () => {
      const result = parseCommandLine([
        'node',
        'cli',
        'sync',
        '--config',
        'test.yaml',
        '--dry-run',
        '--force',
        '--diff',
        '--diff-html',
        '--diff-json'
      ]);

      expect(result).toEqual({
        command: 'sync',
        config: 'test.yaml',
        dryRun: true,
        force: true,
        diff: true,
        diffHtml: true,
        diffJson: true
      });
    });

    it('should call help when sync command without --config', () => {
      parseCommandLine(['node', 'cli', 'sync']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('--config option is required'));
    });

    it('should use default false values when flags not provided', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml']);

      if (result.command === 'sync') {
        expect(result.dryRun).toBe(false);
        expect(result.force).toBe(false);
        expect(result.diff).toBe(false);
        expect(result.diffHtml).toBe(false);
        expect(result.diffJson).toBe(false);
      }
    });

    it('should parse config path with spaces', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'path with spaces/config.yaml']);

      if (result.command === 'sync') expect(result.config).toBe('path with spaces/config.yaml');
    });

    it('should parse relative config path', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', './config.yaml']);

      if (result.command === 'sync') expect(result.config).toBe('./config.yaml');
    });

    it('should parse absolute config path', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', '/absolute/path/config.yaml']);

      if (result.command === 'sync') expect(result.config).toBe('/absolute/path/config.yaml');
    });

    it('should parse flags in different orders', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--dry-run', '--config', 'test.yaml', '--force']);

      expect(result).toEqual({
        command: 'sync',
        config: 'test.yaml',
        dryRun: true,
        force: true,
        diff: false,
        diffHtml: false,
        diffJson: false
      });
    });

    it('should have discriminated union type with command sync', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml']);

      expect(result.command).toBe('sync');
    });

    it('should parse sync command with --diff and --diff-json together', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--diff', '--diff-json']);

      if (result.command === 'sync') {
        expect(result.diff).toBe(true);
        expect(result.diffJson).toBe(true);
        expect(result.diffHtml).toBe(false);
      }
    });

    it('should parse sync command with --diff-html and --diff-json together', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml', '--diff-html', '--diff-json']);

      if (result.command === 'sync') {
        expect(result.diffHtml).toBe(true);
        expect(result.diffJson).toBe(true);
        expect(result.diff).toBe(false);
      }
    });

    it('should parse sync command with all three diff flags together', () => {
      const result = parseCommandLine([
        'node',
        'cli',
        'sync',
        '--config',
        'test.yaml',
        '--diff',
        '--diff-html',
        '--diff-json'
      ]);

      if (result.command === 'sync') {
        expect(result.diff).toBe(true);
        expect(result.diffHtml).toBe(true);
        expect(result.diffJson).toBe(true);
      }
    });
  });

  describe('init command', () => {
    it('should parse init command without path (default)', () => {
      const result = parseCommandLine(['node', 'cli', 'init']);

      expect(result).toEqual({
        command: 'init',
        outputPath: './config.yaml'
      });
    });

    it('should parse init command with custom path', () => {
      const result = parseCommandLine(['node', 'cli', 'init', 'custom.yaml']);

      expect(result).toEqual({
        command: 'init',
        outputPath: 'custom.yaml'
      });
    });

    it('should parse init command with path containing spaces', () => {
      const result = parseCommandLine(['node', 'cli', 'init', 'path with spaces/config.yaml']);

      if (result.command === 'init') expect(result.outputPath).toBe('path with spaces/config.yaml');
    });

    it('should parse init command with relative path', () => {
      const result = parseCommandLine(['node', 'cli', 'init', './my-config.yaml']);

      if (result.command === 'init') expect(result.outputPath).toBe('./my-config.yaml');
    });

    it('should parse init command with absolute path', () => {
      const result = parseCommandLine(['node', 'cli', 'init', '/absolute/path/config.yaml']);

      if (result.command === 'init') expect(result.outputPath).toBe('/absolute/path/config.yaml');
    });

    it('should have discriminated union type with command init', () => {
      const result = parseCommandLine(['node', 'cli', 'init']);

      expect(result.command).toBe('init');
    });

    it('should use empty string or default when empty string provided', () => {
      const result = parseCommandLine(['node', 'cli', 'init', '']);

      if (result.command === 'init') expect(result.outputPath).toBeTruthy();
    });

    it('should handle directory path without filename', () => {
      const result = parseCommandLine(['node', 'cli', 'init', './configs/']);

      if (result.command === 'init') expect(result.outputPath).toBe('./configs/');
    });
  });

  describe('general CLI parsing', () => {
    it('should call error and exit when no command specified', () => {
      parseCommandLine(['node', 'cli']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No command specified'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should use process.argv when argv not provided', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli', 'init', 'test.yaml'];

      const result = parseCommandLine();

      expect(result.command).toBe('init');
      if (result.command === 'init') expect(result.outputPath).toBe('test.yaml');

      process.argv = originalArgv;
    });

    it('should return discriminated union type', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '--config', 'test.yaml']);

      if (result.command === 'sync') {
        expect(result.config).toBeDefined();
        expect(result.dryRun).toBeDefined();
      } else expect(result.outputPath).toBeDefined();
    });

    it('should handle sync command with minimal args', () => {
      const result = parseCommandLine(['node', 'cli', 'sync', '-c', 'cfg.yaml']);

      expect(result.command).toBe('sync');
      if (result.command === 'sync') expect(result.config).toBe('cfg.yaml');
    });

    it('should handle init command with minimal args', () => {
      const result = parseCommandLine(['node', 'cli', 'init']);

      expect(result.command).toBe('init');
    });
  });
});
