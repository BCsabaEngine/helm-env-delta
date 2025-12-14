import { Command } from 'commander';

// Command-line options for helm-env-delta CLI.
export interface CliOptions {
  // Path to configuration YAML file (required).
  config: string;

  // Preview changes only without writing files.
  dryRun: boolean;

  // Skip stop rules validation.
  force: boolean;

  // Generate HTML diff report in temp folder and open it.
  htmlReport: boolean;
}

// Parses command-line arguments using Commander.js
export const parseCommandLine = (argv?: string[]): CliOptions => {
  const program = new Command();

  program
    .name('helm-env-delta')
    .option('-c, --config <file>', 'Path to config YAML (required)')
    .option('--dry-run', 'Preview changes only', false)
    .option('--html-report', 'Generate HTML diff report in temp folder and open it', false)
    .option('--force', 'Skip stop rules', false);

  program.parse(argv || process.argv);

  const options = program.opts<CliOptions>();

  // Validate that required --config option is provided
  if (!options.config) {
    console.error('Error: --config option is required\n');
    program.help();
  }

  return options;
};
