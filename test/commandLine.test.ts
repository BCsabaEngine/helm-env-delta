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

  // Note: Help text with examples is manually tested via `npm run dev -- --help`
  // Commander's help output is difficult to capture in unit tests as it writes directly to process.stdout

  describe('parseCommandLine', () => {
    it('should parse command with --config flag', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: false,
        force: false,
        diff: false,
        diffHtml: false,
        diffJson: false,
        skipFormat: false,
        validate: false,
        listFiles: false,
        showConfig: false,
        noColor: false,
        verbose: false,
        quiet: false,
        suggest: false,
        suggestThreshold: 0.3
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
        diffJson: true,
        skipFormat: false,
        validate: false,
        listFiles: false,
        showConfig: false,
        noColor: false,
        verbose: false,
        quiet: false,
        suggest: false,
        suggestThreshold: 0.3
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
      expect(result.skipFormat).toBe(false);
      expect(result.validate).toBe(false);
      expect(result.listFiles).toBe(false);
      expect(result.showConfig).toBe(false);
      expect(result.noColor).toBe(false);
      expect(result.verbose).toBe(false);
      expect(result.quiet).toBe(false);
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
        diffJson: false,
        skipFormat: false,
        validate: false,
        listFiles: false,
        showConfig: false,
        noColor: false,
        verbose: false,
        quiet: false,
        suggest: false,
        suggestThreshold: 0.3
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

    it('should parse command with --skip-format', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--skip-format']);

      expect(result.skipFormat).toBe(true);
    });

    it('should default skipFormat to false when flag not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.skipFormat).toBe(false);
    });

    it('should parse command with --skip-format and other flags', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--dry-run', '--skip-format', '--diff']);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: true,
        force: false,
        diff: true,
        diffHtml: false,
        diffJson: false,
        skipFormat: true,
        validate: false,
        listFiles: false,
        showConfig: false,
        noColor: false,
        verbose: false,
        quiet: false,
        suggest: false,
        suggestThreshold: 0.3
      });
    });

    it('should parse command with --validate', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--validate']);

      expect(result.validate).toBe(true);
      expect(result.dryRun).toBe(false);
    });

    it('should default validate to false when flag not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.validate).toBe(false);
    });

    it('should parse command with --validate and other flags', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--validate', '--diff']);

      expect(result.validate).toBe(true);
      expect(result.diff).toBe(true);
    });

    it('should parse flags in different orders with --validate', () => {
      const result = parseCommandLine(['node', 'cli', '--validate', '--config', 'test.yaml']);

      expect(result.config).toBe('test.yaml');
      expect(result.validate).toBe(true);
    });

    it('should parse command with --verbose', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--verbose']);

      expect(result.verbose).toBe(true);
      expect(result.quiet).toBe(false);
    });

    it('should parse command with --quiet', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--quiet']);

      expect(result.quiet).toBe(true);
      expect(result.verbose).toBe(false);
    });

    it('should default verbose and quiet to false when flags not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.verbose).toBe(false);
      expect(result.quiet).toBe(false);
    });

    it('should exit when both --verbose and --quiet are provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--verbose', '--quiet']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --verbose and --quiet flags are mutually exclusive');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
    });

    it('should exit when both --quiet and --verbose are provided (different order)', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--quiet', '--verbose']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --verbose and --quiet flags are mutually exclusive');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
    });

    it('should parse command with --verbose and other flags', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--verbose', '--dry-run', '--diff']);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: true,
        force: false,
        diff: true,
        diffHtml: false,
        diffJson: false,
        skipFormat: false,
        validate: false,
        listFiles: false,
        showConfig: false,
        noColor: false,
        verbose: true,
        quiet: false,
        suggest: false,
        suggestThreshold: 0.3
      });
    });

    it('should parse command with --quiet and other flags', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--quiet', '--diff-json']);

      expect(result).toEqual({
        config: 'test.yaml',
        dryRun: false,
        force: false,
        diff: false,
        diffHtml: false,
        diffJson: true,
        skipFormat: false,
        validate: false,
        listFiles: false,
        showConfig: false,
        noColor: false,
        verbose: false,
        quiet: true,
        suggest: false,
        suggestThreshold: 0.3
      });
    });

    it('should parse command with --list-files', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--list-files']);

      expect(result.listFiles).toBe(true);
      expect(result.showConfig).toBe(false);
    });

    it('should default listFiles to false when flag not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.listFiles).toBe(false);
    });

    it('should parse command with --show-config', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--show-config']);

      expect(result.showConfig).toBe(true);
      expect(result.listFiles).toBe(false);
    });

    it('should default showConfig to false when flag not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.showConfig).toBe(false);
    });

    it('should parse command with --no-color', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml', '--no-color']);

      expect(result.noColor).toBe(true);
    });

    it('should default noColor to false when flag not provided', () => {
      const result = parseCommandLine(['node', 'cli', '--config', 'test.yaml']);

      expect(result.noColor).toBe(false);
    });

    it('should parse command with all new flags combined', () => {
      const result = parseCommandLine([
        'node',
        'cli',
        '--config',
        'test.yaml',
        '--list-files',
        '--show-config',
        '--no-color'
      ]);

      expect(result.listFiles).toBe(true);
      expect(result.showConfig).toBe(true);
      expect(result.noColor).toBe(true);
    });
  });
});
