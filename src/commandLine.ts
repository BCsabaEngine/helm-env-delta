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
  validate: boolean;
  verbose: boolean;
  quiet: boolean;
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
    .option('--validate', 'Validate configuration file and exit', false)
    .option('--verbose', 'Show detailed debug information', false)
    .option('--quiet', 'Suppress all output except critical errors', false);

  program.parse(argv || process.argv);
  const options = program.opts();

  // Check for mutually exclusive flags
  if (options['verbose'] && options['quiet']) {
    console.error('Error: --verbose and --quiet flags are mutually exclusive');
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
    validate: options['validate'],
    verbose: options['verbose'],
    quiet: options['quiet']
  };
};
