import { Command } from 'commander';

/**
 * Command-line options for helm-env-delta CLI.
 * Parsed from process.argv by Commander.js.
 */
export interface CliOptions {
  /**
   * Path to configuration YAML file.
   * @default "config.yaml"
   */
  config: string;

  /**
   * Preview changes only without writing files.
   * @default false
   */
  dryRun: boolean;

  /**
   * Skip stop rules validation.
   * @default false
   */
  force: boolean;

  /**
   * Path to HTML report file to generate.
   * @default undefined
   */
  htmlReport?: string;
}

/**
 * Parses command-line arguments using Commander.js.
 *
 * @param argv - Optional array of arguments to parse (defaults to process.argv)
 * @returns Parsed CLI options with type safety
 *
 * @example
 * ```typescript
 * // Parse default process.argv
 * const options = parseCommandLine();
 *
 * // Parse custom arguments (useful for testing)
 * const options = parseCommandLine(['node', 'hed', '-c', 'prod.yaml', '--dry-run']);
 * ```
 */
export function parseCommandLine(argv?: string[]): CliOptions {
  const program = new Command();

  program
    .name('helm-env-delta')
    .description('Environment-aware Helm YAML diff & sync tool')
    .option('-c, --config <file>', 'Path to config YAML', 'config.yaml')
    .option('--dry-run', 'Preview changes only', false)
    .option('--force', 'Skip stop rules', false)
    .option('--html-report <file>', 'Write diff report HTML and open it');

  program.parse(argv || process.argv);

  return program.opts<CliOptions>();
}
