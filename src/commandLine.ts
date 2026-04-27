import { Command, CommanderError } from 'commander';

import packageJson from '../package.json';
import { EXIT_CONFIG_ERROR } from './exitCodes';

// ============================================================================
// Command Types
// ============================================================================

export type ChangeMode = 'new' | 'modified' | 'deleted' | 'all';

export type CommandName = 'run' | 'validate' | 'format' | 'suggest' | 'diff' | 'list-files' | 'show-config';

export type SyncCommand = {
  commandName: CommandName;
  config: string;
  dryRun: boolean;
  force: boolean;
  strict: boolean;
  html: boolean;
  json: boolean;
  reportOutput?: string;
  skipFormat: boolean;
  suggestThreshold: number;
  filter?: string;
  mode: ChangeMode;
  my: boolean;
  myDays: number;
  verbose: boolean;
  quiet: boolean;
  noColor: boolean;
};

// ============================================================================
// Shared validation helpers
// ============================================================================

const exitOverrideFunction = (error: CommanderError) => {
  if (error.exitCode === 0) process.exit(0);
  process.exit(EXIT_CONFIG_ERROR);
};

const validModes = ['new', 'modified', 'deleted', 'all'];

const parseMode = (mode: string): ChangeMode => {
  if (!validModes.includes(mode)) {
    console.error('Error: --mode must be one of: ' + validModes.join(', '));
    process.exit(EXIT_CONFIG_ERROR);
  }
  return mode as ChangeMode;
};

const parseMyDays = (myRaw: string | boolean | undefined): { my: boolean; myDays: number } => {
  if (myRaw === undefined || myRaw === false) return { my: false, myDays: 30 };
  if (myRaw === true) return { my: true, myDays: 30 };
  const parsed = Number.parseInt(myRaw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    console.error('Error: --my days must be a positive integer');
    process.exit(EXIT_CONFIG_ERROR);
  }
  return { my: true, myDays: parsed };
};

const checkVerboseQuiet = (verbose: boolean, quiet: boolean) => {
  if (verbose && quiet) {
    console.error('Error: --verbose and --quiet flags are mutually exclusive');
    process.exit(EXIT_CONFIG_ERROR);
  }
};

const addGlobalOptions = (cmd: Command): Command =>
  cmd
    .option('--verbose', 'Show detailed debug information', false)
    .option('--quiet', 'Suppress all output except critical errors', false)
    .option('--no-color', 'Disable colored output');

// ============================================================================
// CLI Parser
// ============================================================================

export const parseCommandLine = (argv?: string[]): SyncCommand => {
  let result: SyncCommand | undefined;

  const program = new Command();
  program
    .name('helm-env-delta')
    .description('Environment-aware YAML delta and sync for GitOps workflows')
    .version(packageJson.version)
    .showSuggestionAfterError(true)
    .exitOverride(exitOverrideFunction);

  // ── run ────────────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('run')
      .description('Sync source YAML changes to destination')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .option('-D, --dry-run', 'Preview changes without writing files', false)
      .option('--force', 'Override stop rules and proceed with changes', false)
      .option('-S, --skip-format', 'Skip YAML formatting (outputFormat section)', false)
      .option('-f, --filter <string>', 'Filter files by name or content (supports , for OR, + for AND)')
      .option('-m, --mode <type>', 'Filter by change type: new, modified, deleted, all', 'all')
      .option('--my [days]', 'Limit to files you modified in the last N days (default: 30)')
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta run -c config.yaml
  $ helm-env-delta run -c config.yaml --dry-run
  $ helm-env-delta run -c config.yaml --force
  $ helm-env-delta run -c config.yaml --mode new
  $ helm-env-delta run -c config.yaml -f prod --my 7
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    const { my, myDays } = parseMyDays(options['my']);
    result = {
      commandName: 'run',
      config: options['config'],
      dryRun: options['dryRun'],
      force: options['force'],
      strict: false,
      html: false,
      json: false,
      skipFormat: options['skipFormat'],
      suggestThreshold: 0.3,
      filter: options['filter'],
      mode: parseMode(options['mode']),
      my,
      myDays,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  // ── validate ───────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('validate')
      .description('Validate configuration and patterns against source files')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .option('-f, --filter <string>', 'Filter files by name or content')
      .option('--my [days]', 'Limit to files you modified in the last N days (default: 30)')
      .option('--strict', 'Exit non-zero if any warnings are found', false)
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta validate -c config.yaml
  $ helm-env-delta validate -c config.yaml -f prod
  $ helm-env-delta validate -c config.yaml --strict
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    const { my, myDays } = parseMyDays(options['my']);
    result = {
      commandName: 'validate',
      config: options['config'],
      dryRun: false,
      force: false,
      strict: options['strict'],
      html: false,
      json: false,
      skipFormat: false,
      suggestThreshold: 0.3,
      filter: options['filter'],
      mode: 'all',
      my,
      myDays,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  // ── format ─────────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('format')
      .description('Format YAML files in destination without syncing')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .option('-D, --dry-run', 'Preview formatting changes without writing files', false)
      .option('-f, --filter <string>', 'Filter files by name or content')
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta format -c config.yaml
  $ helm-env-delta format -c config.yaml --dry-run
  $ helm-env-delta format -c config.yaml -f prod
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    result = {
      commandName: 'format',
      config: options['config'],
      dryRun: options['dryRun'],
      force: false,
      strict: false,
      html: false,
      json: false,
      skipFormat: false,
      suggestThreshold: 0.3,
      filter: options['filter'],
      mode: 'all',
      my: false,
      myDays: 30,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  // ── suggest ────────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('suggest')
      .description('Analyze differences and suggest transforms and stop rules')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .option('--suggest-threshold <number>', 'Minimum confidence for suggestions (0-1, default: 0.3)', '0.3')
      .option('-f, --filter <string>', 'Filter files by name or content')
      .option('-m, --mode <type>', 'Filter by change type: new, modified, deleted, all', 'all')
      .option('--my [days]', 'Limit to files you modified in the last N days (default: 30)')
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta suggest -c config.yaml
  $ helm-env-delta suggest -c config.yaml --suggest-threshold 0.5
  $ helm-env-delta suggest -c config.yaml -f prod
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    const threshold = Number.parseFloat(options['suggestThreshold']);
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
      console.error('Error: --suggest-threshold must be a number between 0 and 1');
      process.exit(EXIT_CONFIG_ERROR);
    }
    const { my, myDays } = parseMyDays(options['my']);
    result = {
      commandName: 'suggest',
      config: options['config'],
      dryRun: false,
      force: false,
      strict: false,
      html: false,
      json: false,
      skipFormat: false,
      suggestThreshold: threshold,
      filter: options['filter'],
      mode: parseMode(options['mode']),
      my,
      myDays,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  // ── diff ───────────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('diff')
      .description('Show changes between source and destination (read-only)')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .option('-H, --html', 'Generate and open HTML diff report in browser', false)
      .option('-J, --json', 'Output diff as JSON to stdout', false)
      .option('--report-output <path>', 'Save HTML report to a file or directory (suppresses browser auto-open)')
      .option('-f, --filter <string>', 'Filter files by name or content')
      .option('-m, --mode <type>', 'Filter by change type: new, modified, deleted, all', 'all')
      .option('--my [days]', 'Limit to files you modified in the last N days (default: 30)')
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta diff -c config.yaml
  $ helm-env-delta diff -c config.yaml --html
  $ helm-env-delta diff -c config.yaml --json | jq '.summary'
  $ helm-env-delta diff -c config.yaml --report-output ./reports/
  $ helm-env-delta diff -c config.yaml -f prod --mode modified
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    const { my, myDays } = parseMyDays(options['my']);
    result = {
      commandName: 'diff',
      config: options['config'],
      dryRun: false,
      force: false,
      strict: false,
      html: options['html'],
      json: options['json'],
      reportOutput: options['reportOutput'],
      skipFormat: false,
      suggestThreshold: 0.3,
      filter: options['filter'],
      mode: parseMode(options['mode']),
      my,
      myDays,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  // ── list-files ─────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('list-files')
      .description('List files that would be loaded without processing diffs')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .option('-f, --filter <string>', 'Filter files by name or content')
      .option('--my [days]', 'Limit to files you modified in the last N days (default: 30)')
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta list-files -c config.yaml
  $ helm-env-delta list-files -c config.yaml -f prod
  $ helm-env-delta list-files -c config.yaml --my 7
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    const { my, myDays } = parseMyDays(options['my']);
    result = {
      commandName: 'list-files',
      config: options['config'],
      dryRun: false,
      force: false,
      strict: false,
      html: false,
      json: false,
      skipFormat: false,
      suggestThreshold: 0.3,
      filter: options['filter'],
      mode: 'all',
      my,
      myDays,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  // ── show-config ────────────────────────────────────────────────────────────
  addGlobalOptions(
    program
      .command('show-config')
      .description('Display resolved configuration after inheritance')
      .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
      .addHelpText(
        'after',
        `
Examples:
  $ helm-env-delta show-config -c config.yaml
`
      )
      .exitOverride(exitOverrideFunction)
  ).action(function (options) {
    checkVerboseQuiet(options['verbose'], options['quiet']);
    result = {
      commandName: 'show-config',
      config: options['config'],
      dryRun: false,
      force: false,
      strict: false,
      html: false,
      json: false,
      skipFormat: false,
      suggestThreshold: 0.3,
      filter: undefined,
      mode: 'all',
      my: false,
      myDays: 30,
      verbose: options['verbose'],
      quiet: options['quiet'],
      noColor: !options['color']
    };
  });

  program.parse(argv ?? process.argv);

  if (!result) {
    program.help();
    process.exit(EXIT_CONFIG_ERROR);
  }

  return result;
};
