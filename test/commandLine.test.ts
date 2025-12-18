import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseCommandLine } from '../src/commandLine';

describe('commandLine', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseCommandLine', () => {
    it('should parse command with --config flag', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: false,
        force: false,
        diff: false,
        diffHtml: false,
        diffJson: false
      });
    });

    it('should parse command with -c short flag', () => {
      const result = parseCommandLine(['node', 'cli', '-c', 'config.yaml']);

      expect(result.config).toBe('config.yaml');
    });

    it('should parse command with --dry-run', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--dry-run']);

      expect(result.dryRun).toBe(true);
      expect(result.force).toBe(false);
    });

    it('should parse command with --force', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--force']);

      expect(result.force).toBe(true);
      expect(result.dryRun).toBe(false);
    });

    it('should parse command with --diff', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--diff']);

      expect(result.diff).toBe(true);
    });

    it('should parse command with --diff-html', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--diff-html']);

      expect(result.diffHtml).toBe(true);
    });

    it('should parse command with --diff-json', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--diff-json']);

      expect(result.diffJson).toBe(true);
    });

    it('should parse command with all flags combined', () => {
      const result = parseCommandLine([
        'node',
        'cli',
        '--config',
        'test.yaml',
        '--dry-run',
        '--force',
        '--diff',
        '--diff-html',
        '--diff-json'
      ]);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: true,
        force: true,
        diff: true,
        diffHtml: true,
        diffJson: true
      });
    });

    it('should exit when command without --config', () => {
      parseCommandLine(['node', 'cli']);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should use default false values when flags not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.dryRun).toBe(false);
      expect(result.force).toBe(false);
      expect(result.diff).toBe(false);
      expect(result.diffHtml).toBe(false);
      expect(result.diffJson).toBe(false);
    });

    it('should parse config path with spaces', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'path with spaces/config.yaml']);

      expect(result.config).toBe('path with spaces/config.yaml');
    });

    it('should parse relative config path', () => {
      const result = parseCommandLine(['node', 'cli', '--config', './config.yaml']);

      expect(result.config).toBe('./config.yaml');
    });

    it('should parse absolute config path', () => {
      const result = parseCommandLine(['node', 'cli', '--config', '/absolute/path/config.yaml']);

      expect(result.config).toBe('/absolute/path/config.yaml');
    });

    it('should parse flags in different orders', () => {
      const result = parseCommandLine(['node', 'cli', '--dry-run', '--config', 'test.yaml', '--force']);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: true,
        force: true,
        diff: false,
        diffHtml: false,
        diffJson: false
      });
    });

    it('should parse command with --diff and --diff-json together', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--diff', '--diff-json']);

      expect(result.diff).toBe(true);
      expect(result.diffJson).toBe(true);
      expect(result.diffHtml).toBe(false);
    });

    it('should parse command with --diff-html and --diff-json together', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--diff-html', '--diff-json']);

      expect(result.diffHtml).toBe(true);
      expect(result.diffJson).toBe(true);
      expect(result.diff).toBe(false);
    });

    it('should parse command with all three diff flags together', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--diff', '--diff-html', '--diff-json']);

      expect(result.diff).toBe(true);
      expect(result.diffHtml).toBe(true);
      expect(result.diffJson).toBe(true);
    });

    it('should use process.argv when argv not provided', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli', '--config', 'test.yaml'];

      const result = parseCommandLine();

      expect(result.config).toBe('test.yaml');

      process.argv = originalArgv;
    });

    it('should handle command with minimal args', () => {
      const result = parseCommandLine(['node', 'cli', '-c', 'cfg.yaml']);

      expect(result.config).toBe('cfg.yaml');
    });
  });
});
