import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseCommandLine } from '../src/commandLine';

describe('commandLine', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as never);
    vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── run command ─────────────────────────────────────────────────────────────

  describe('run command', () => {
    it('should parse with --config flag', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '--config', 'test.yaml']);

      expect(result).toEqual({
        commandName: 'run',
        config: 'test.yaml',
        dryRun: false,
        force: false,
        html: false,
        json: false,
        reportOutput: undefined,
        skipFormat: false,
        suggestThreshold: 0.3,
        filter: undefined,
        mode: 'all',
        my: false,
        myDays: 30,
        noColor: false,
        verbose: false,
        quiet: false
      });
    });

    it('should parse with -c short flag', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '-c', 'config.yaml']);

      expect(result.config).toBe('config.yaml');
      expect(result.commandName).toBe('run');
    });

    it('should parse --dry-run / -D', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--dry-run']).dryRun).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '-D']).dryRun).toBe(true);
    });

    it('should parse --force', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--force']);

      expect(result.force).toBe(true);
      expect(result.dryRun).toBe(false);
    });

    it('should parse --skip-format / -S', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--skip-format']).skipFormat).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '-S']).skipFormat).toBe(true);
    });

    it('should parse --filter / -f', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--filter', 'prod']).filter).toBe('prod');
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '-f', 'staging']).filter).toBe('staging');
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml']).filter).toBeUndefined();
    });

    it('should parse filter with spaces', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '-f', 'prod values']);

      expect(result.filter).toBe('prod values');
    });

    it('should parse --mode values', () => {
      for (const mode of ['new', 'modified', 'deleted', 'all']) {
        const result = parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--mode', mode]);
        expect(result.mode).toBe(mode);
      }
    });

    it('should parse --mode / -m short flag', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '-m', 'new']).mode).toBe('new');
    });

    it('should default mode to all', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml']).mode).toBe('all');
    });

    it('should exit when --mode has invalid value', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--mode', 'invalid']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --mode must be one of: new, modified, deleted, all');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('should parse --my alone as my: true, myDays: 30', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--my']);

      expect(result.my).toBe(true);
      expect(result.myDays).toBe(30);
    });

    it('should parse --my with days', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--my', '7']).myDays).toBe(7);
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--my', '1']).myDays).toBe(1);
    });

    it('should exit when --my 0 is provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--my', '0']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --my days must be a positive integer');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('should exit when --my abc is provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--my', 'abc']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --my days must be a positive integer');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('should parse --verbose and --quiet', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--verbose']).verbose).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--quiet']).quiet).toBe(true);
    });

    it('should exit when both --verbose and --quiet are provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--verbose', '--quiet']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --verbose and --quiet flags are mutually exclusive');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('should parse --no-color', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml', '--no-color']).noColor).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'run', '-c', 'test.yaml']).noColor).toBe(false);
    });

    it('should exit when run without --config', () => {
      parseCommandLine(['node', 'cli', 'run']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });

    it('should parse config path variants', () => {
      expect(parseCommandLine(['node', 'cli', 'run', '--config', 'path with spaces/config.yaml']).config).toBe(
        'path with spaces/config.yaml'
      );
      expect(parseCommandLine(['node', 'cli', 'run', '--config', './config.yaml']).config).toBe('./config.yaml');
      expect(parseCommandLine(['node', 'cli', 'run', '--config', '/absolute/path/config.yaml']).config).toBe(
        '/absolute/path/config.yaml'
      );
    });

    it('should parse options in different orders', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '--force', '--config', 'test.yaml', '--dry-run']);

      expect(result.force).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.config).toBe('test.yaml');
    });

    it('should parse combined options', () => {
      const result = parseCommandLine([
        'node',
        'cli',
        'run',
        '-c',
        'test.yaml',
        '--dry-run',
        '--force',
        '-S',
        '-f',
        'prod',
        '--mode',
        'modified',
        '--verbose'
      ]);

      expect(result).toEqual({
        commandName: 'run',
        config: 'test.yaml',
        dryRun: true,
        force: true,
        html: false,
        json: false,
        reportOutput: undefined,
        skipFormat: true,
        suggestThreshold: 0.3,
        filter: 'prod',
        mode: 'modified',
        my: false,
        myDays: 30,
        noColor: false,
        verbose: true,
        quiet: false
      });
    });
  });

  // ── validate command ────────────────────────────────────────────────────────

  describe('validate command', () => {
    it('should parse basic validate command', () => {
      const result = parseCommandLine(['node', 'cli', 'validate', '-c', 'config.yaml']);

      expect(result.commandName).toBe('validate');
      expect(result.config).toBe('config.yaml');
      expect(result.dryRun).toBe(false);
      expect(result.force).toBe(false);
      expect(result.html).toBe(false);
      expect(result.json).toBe(false);
      expect(result.filter).toBeUndefined();
      expect(result.my).toBe(false);
      expect(result.myDays).toBe(30);
    });

    it('should parse --filter and --my options', () => {
      const result = parseCommandLine(['node', 'cli', 'validate', '-c', 'cfg.yaml', '-f', 'prod', '--my', '14']);

      expect(result.filter).toBe('prod');
      expect(result.my).toBe(true);
      expect(result.myDays).toBe(14);
    });

    it('should parse --verbose and --quiet', () => {
      expect(parseCommandLine(['node', 'cli', 'validate', '-c', 'cfg.yaml', '--verbose']).verbose).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'validate', '-c', 'cfg.yaml', '--quiet']).quiet).toBe(true);
    });

    it('should exit when validate without --config', () => {
      parseCommandLine(['node', 'cli', 'validate']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });

    it('should exit when both --verbose and --quiet are provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'validate', '-c', 'cfg.yaml', '--verbose', '--quiet']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --verbose and --quiet flags are mutually exclusive');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });
  });

  // ── format command ──────────────────────────────────────────────────────────

  describe('format command', () => {
    it('should parse basic format command', () => {
      const result = parseCommandLine(['node', 'cli', 'format', '-c', 'config.yaml']);

      expect(result.commandName).toBe('format');
      expect(result.config).toBe('config.yaml');
      expect(result.dryRun).toBe(false);
      expect(result.filter).toBeUndefined();
    });

    it('should parse --dry-run / -D', () => {
      expect(parseCommandLine(['node', 'cli', 'format', '-c', 'cfg.yaml', '--dry-run']).dryRun).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'format', '-c', 'cfg.yaml', '-D']).dryRun).toBe(true);
    });

    it('should parse --filter', () => {
      expect(parseCommandLine(['node', 'cli', 'format', '-c', 'cfg.yaml', '-f', 'prod']).filter).toBe('prod');
    });

    it('should exit when format without --config', () => {
      parseCommandLine(['node', 'cli', 'format']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });
  });

  // ── suggest command ─────────────────────────────────────────────────────────

  describe('suggest command', () => {
    it('should parse basic suggest command', () => {
      const result = parseCommandLine(['node', 'cli', 'suggest', '-c', 'config.yaml']);

      expect(result.commandName).toBe('suggest');
      expect(result.config).toBe('config.yaml');
      expect(result.suggestThreshold).toBe(0.3);
      expect(result.filter).toBeUndefined();
      expect(result.mode).toBe('all');
    });

    it('should parse --suggest-threshold', () => {
      expect(
        parseCommandLine(['node', 'cli', 'suggest', '-c', 'cfg.yaml', '--suggest-threshold', '0.5']).suggestThreshold
      ).toBe(0.5);
      expect(
        parseCommandLine(['node', 'cli', 'suggest', '-c', 'cfg.yaml', '--suggest-threshold', '0']).suggestThreshold
      ).toBe(0);
      expect(
        parseCommandLine(['node', 'cli', 'suggest', '-c', 'cfg.yaml', '--suggest-threshold', '1']).suggestThreshold
      ).toBe(1);
    });

    it('should exit when --suggest-threshold is out of range', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'suggest', '-c', 'cfg.yaml', '--suggest-threshold', '1.5']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --suggest-threshold must be a number between 0 and 1');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('should exit when --suggest-threshold is not a number', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'suggest', '-c', 'cfg.yaml', '--suggest-threshold', 'abc']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --suggest-threshold must be a number between 0 and 1');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('should parse --filter and --mode', () => {
      const result = parseCommandLine(['node', 'cli', 'suggest', '-c', 'cfg.yaml', '-f', 'prod', '-m', 'modified']);

      expect(result.filter).toBe('prod');
      expect(result.mode).toBe('modified');
    });

    it('should exit when suggest without --config', () => {
      parseCommandLine(['node', 'cli', 'suggest']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });
  });

  // ── diff command ────────────────────────────────────────────────────────────

  describe('diff command', () => {
    it('should parse basic diff command', () => {
      const result = parseCommandLine(['node', 'cli', 'diff', '-c', 'config.yaml']);

      expect(result.commandName).toBe('diff');
      expect(result.config).toBe('config.yaml');
      expect(result.html).toBe(false);
      expect(result.json).toBe(false);
      expect(result.reportOutput).toBeUndefined();
      expect(result.filter).toBeUndefined();
      expect(result.mode).toBe('all');
    });

    it('should parse --html / -H', () => {
      expect(parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '--html']).html).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '-H']).html).toBe(true);
    });

    it('should parse --json / -J', () => {
      expect(parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '--json']).json).toBe(true);
      expect(parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '-J']).json).toBe(true);
    });

    it('should parse --report-output', () => {
      const result = parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '--report-output', './reports/']);

      expect(result.reportOutput).toBe('./reports/');
    });

    it('should parse --html and --json together', () => {
      const result = parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '--html', '--json']);

      expect(result.html).toBe(true);
      expect(result.json).toBe(true);
    });

    it('should parse --filter and --mode', () => {
      const result = parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '-f', 'prod', '--mode', 'modified']);

      expect(result.filter).toBe('prod');
      expect(result.mode).toBe('modified');
    });

    it('should parse --my option', () => {
      const result = parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '--my', '7']);

      expect(result.my).toBe(true);
      expect(result.myDays).toBe(7);
    });

    it('should exit when diff without --config', () => {
      parseCommandLine(['node', 'cli', 'diff']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });

    it('should exit when --mode invalid on diff', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parseCommandLine(['node', 'cli', 'diff', '-c', 'cfg.yaml', '--mode', 'bad']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --mode must be one of: new, modified, deleted, all');
      expect(processExitSpy).toHaveBeenCalledWith(3);

      consoleErrorSpy.mockRestore();
    });

    it('run command should not have html/json/reportOutput options', () => {
      const result = parseCommandLine(['node', 'cli', 'run', '-c', 'cfg.yaml']);

      expect(result.html).toBe(false);
      expect(result.json).toBe(false);
      expect(result.reportOutput).toBeUndefined();
    });
  });

  // ── list-files command ──────────────────────────────────────────────────────

  describe('list-files command', () => {
    it('should parse basic list-files command', () => {
      const result = parseCommandLine(['node', 'cli', 'list-files', '-c', 'config.yaml']);

      expect(result.commandName).toBe('list-files');
      expect(result.config).toBe('config.yaml');
      expect(result.filter).toBeUndefined();
      expect(result.my).toBe(false);
    });

    it('should parse --filter and --my', () => {
      const result = parseCommandLine(['node', 'cli', 'list-files', '-c', 'cfg.yaml', '-f', 'prod', '--my', '30']);

      expect(result.filter).toBe('prod');
      expect(result.my).toBe(true);
      expect(result.myDays).toBe(30);
    });

    it('should exit when list-files without --config', () => {
      parseCommandLine(['node', 'cli', 'list-files']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });
  });

  // ── show-config command ─────────────────────────────────────────────────────

  describe('show-config command', () => {
    it('should parse basic show-config command', () => {
      const result = parseCommandLine(['node', 'cli', 'show-config', '-c', 'config.yaml']);

      expect(result.commandName).toBe('show-config');
      expect(result.config).toBe('config.yaml');
      expect(result.filter).toBeUndefined();
      expect(result.verbose).toBe(false);
      expect(result.quiet).toBe(false);
    });

    it('should parse --verbose on show-config', () => {
      expect(parseCommandLine(['node', 'cli', 'show-config', '-c', 'cfg.yaml', '--verbose']).verbose).toBe(true);
    });

    it('should exit when show-config without --config', () => {
      parseCommandLine(['node', 'cli', 'show-config']);

      expect(processExitSpy).toHaveBeenCalledWith(3);
    });
  });

  // ── global behavior ─────────────────────────────────────────────────────────

  describe('global behavior', () => {
    it('should exit when no command given', () => {
      parseCommandLine(['node', 'cli']);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should use process.argv when argv not provided', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli', 'run', '--config', 'test.yaml'];

      const result = parseCommandLine();

      expect(result.config).toBe('test.yaml');
      expect(result.commandName).toBe('run');

      process.argv = originalArgv;
    });
  });
});
