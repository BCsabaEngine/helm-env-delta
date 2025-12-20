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
    .option('--validate', 'Validate configuration file and exit', false);

  program.parse(argv || process.argv);
  const options = program.opts();

  return {
    config: options['config'],
    dryRun: options['dryRun'],
    force: options['force'],
    diff: options['diff'],
    diffHtml: options['diffHtml'],
    diffJson: options['diffJson'],
    skipFormat: options['skipFormat'],
    validate: options['validate']
  };
};
