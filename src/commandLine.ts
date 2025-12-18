import { Command } from 'commander';

// ============================================================================
// Command Types
// ============================================================================

export type SyncCommand = {
  command: 'sync';
  config: string;
  dryRun: boolean;
  force: boolean;
  diff: boolean;
  diffHtml: boolean;
  diffJson: boolean;
};

export type InitCommand = {
  command: 'init';
  outputPath: string;
};

export type CliCommand = SyncCommand | InitCommand;

// ============================================================================
// CLI Parser
// ============================================================================

export const parseCommandLine = (argv?: string[]): CliCommand => {
  const program = new Command();
  let result: CliCommand | undefined;

  program.name('helm-env-delta').description('Environment-aware YAML delta and sync for GitOps workflows');

  // Sync command
  program
    .command('sync')
    .description('Sync files from source to destination with YAML processing')
    .option('-c, --config <file>', 'Path to config YAML (required)')
    .option('--dry-run', 'Preview changes only', false)
    .option('--diff', 'Show diff output in console', false)
    .option('--diff-html', 'Generate HTML diff report in temp folder and open it', false)
    .option('--diff-json', 'Output diff as JSON to stdout', false)
    .option('--force', 'Skip stop rules', false)
    .action((options) => {
      // Validate required --config option
      if (!options.config) {
        console.error('Error: --config option is required\n');
        program.help();
      }

      result = {
        command: 'sync',
        config: options.config,
        dryRun: options.dryRun || false,
        force: options.force || false,
        diff: options.diff || false,
        diffHtml: options.diffHtml || false,
        diffJson: options.diffJson || false
      };
    });

  // Init command
  program
    .command('init [path]')
    .description('Generate a config.yaml template with all features')
    .action((path?: string) => {
      result = {
        command: 'init',
        outputPath: path || './config.yaml'
      };
    });

  program.parse(argv || process.argv);

  // Should always have a result due to isDefault on sync command
  if (!result) {
    console.error('Error: No command specified\n');
    program.help();
    process.exit(1);
  }

  return result;
};
