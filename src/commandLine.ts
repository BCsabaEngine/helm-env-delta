import { Command } from 'commander';

import packageJson from '../package.json';

// ============================================================================
// Command Types
// ============================================================================

export type SyncCommand = {
  config: string;
  dryRun: boolean;
  force: boolean;
  diff: boolean;
  diffHtml: boolean;
  diffJson: boolean;
  skipFormat: boolean;
  formatOnly: boolean;
  validate: boolean;
  verbose: boolean;
  quiet: boolean;
  listFiles: boolean;
  showConfig: boolean;
  noColor: boolean;
  suggest: boolean;
  suggestThreshold: number;
};

// ============================================================================
// CLI Parser
// ============================================================================

export const parseCommandLine = (argv?: string[]): SyncCommand => {
  const program = new Command();

  program
    .name('helm-env-delta')
    .description('Environment-aware YAML delta and sync for GitOps workflows')
    .version(packageJson.version)
    .requiredOption('-c, --config <file>', 'Path to YAML configuration file')
    .option('--dry-run', 'Preview changes without writing files', false)
    .option('--force', 'Override stop rules and proceed with changes', false)
    .option('--diff', 'Display console diff for changed files', false)
    .option('--diff-html', 'Generate and open HTML diff report in browser', false)
    .option('--diff-json', 'Output diff as JSON to stdout', false)
    .option('--skip-format', 'Skip YAML formatting (outputFormat section)', false)
    .option('--format-only', 'Format YAML files in destination without syncing', false)
    .option('--validate', 'Validate configuration file and exit', false)
    .option('--list-files', 'List files that would be synced without processing diffs', false)
    .option('--show-config', 'Display resolved configuration after inheritance and exit', false)
    .option('--suggest', 'Analyze differences and suggest transforms and stop rules', false)
    .option('--suggest-threshold <number>', 'Minimum confidence for suggestions (0-1, default: 0.3)', '0.3')
    .option('--no-color', 'Disable colored output')
    .option('--verbose', 'Show detailed debug information', false)
    .option('--quiet', 'Suppress all output except critical errors', false)
    .addHelpText(
      'after',
      `
Examples:
  # Preview changes before syncing
  $ helm-env-delta --config config.yaml --dry-run --diff

  # Get configuration suggestions
  $ helm-env-delta --config config.yaml --suggest

  # Sync with HTML diff report
  $ helm-env-delta --config config.yaml --diff-html

  # Validate stop rules without syncing
  $ helm-env-delta --config config.yaml --validate

  # CI/CD usage with JSON output
  $ helm-env-delta --config config.yaml --diff-json | jq '.summary'

Documentation: https://github.com/balazscsaba2006/helm-env-delta
`
    );

  // Enable suggestion for typos (built-in commander feature)
  program.showSuggestionAfterError(true);

  program.parse(argv || process.argv);
  const options = program.opts();

  // Check for mutually exclusive flags
  if (options['verbose'] && options['quiet']) {
    console.error('Error: --verbose and --quiet flags are mutually exclusive');
    process.exit(1);
  }

  if (options['formatOnly'] && options['skipFormat']) {
    console.error('Error: --format-only and --skip-format flags are mutually exclusive');
    process.exit(1);
  }

  // Validate --suggest-threshold value
  const threshold = Number.parseFloat(options['suggestThreshold']);
  if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    console.error('Error: --suggest-threshold must be a number between 0 and 1');
    process.exit(1);
  }

  return {
    config: options['config'],
    dryRun: options['dryRun'],
    force: options['force'],
    diff: options['diff'],
    diffHtml: options['diffHtml'],
    diffJson: options['diffJson'],
    skipFormat: options['skipFormat'],
    formatOnly: options['formatOnly'],
    validate: options['validate'],
    listFiles: options['listFiles'],
    showConfig: options['showConfig'],
    noColor: !options['color'], // Commander's --no-color creates a 'color' property
    verbose: options['verbose'],
    quiet: options['quiet'],
    suggest: options['suggest'],
    suggestThreshold: threshold
  };
};
