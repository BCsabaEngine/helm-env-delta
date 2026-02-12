import {
  colorizeFileOperation,
  FileOperation,
  formatProgressMessage,
  formatStopRuleViolation,
  ProgressStyle,
  ViolationMode
} from './consoleFormatter';
import { StopRuleViolation } from './pipeline/stopRulesValidator';

// ============================================================================
// Types
// ============================================================================

export type VerbosityLevel = 'quiet' | 'normal' | 'verbose';

export type OutputCategory = 'critical' | 'normal' | 'debug' | 'special';

export type LoggerOptions = {
  level: VerbosityLevel;
  isDiffJson: boolean;
};

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private level: VerbosityLevel;

  constructor(options: LoggerOptions) {
    this.level = options.level;
  }

  // Check if a category should be shown based on verbosity level
  shouldShow(category: OutputCategory): boolean {
    // Machine-readable output always shows
    if (category === 'special') return true;

    // Critical messages always show (errors, stop rules)
    if (category === 'critical') return true;

    // Quiet mode: only critical
    if (this.level === 'quiet') return false;

    // Verbose mode: everything
    if (this.level === 'verbose') return true;

    // Normal mode: critical + normal (not debug)
    return category === 'normal';
  }

  // Core logging methods
  log(message: string, category: OutputCategory = 'normal'): void {
    if (this.shouldShow(category)) console.log(message);
  }

  warn(message: string, category: OutputCategory = 'normal'): void {
    if (this.shouldShow(category)) console.warn(message);
  }

  error(message: string, category: OutputCategory = 'critical'): void {
    if (this.shouldShow(category)) console.error(message);
  }

  // Debug-specific method (always uses 'debug' category)
  debug(message: string): void {
    if (this.shouldShow('debug')) console.log(message);
  }

  // Convenience methods wrapping consoleFormatter
  progress(message: string, style: ProgressStyle): void {
    if (this.shouldShow('normal')) console.log(formatProgressMessage(message, style));
  }

  fileOp(operation: FileOperation, path: string, isDryRun: boolean, alreadyDeleted: boolean = false): void {
    if (this.shouldShow('normal')) console.log(colorizeFileOperation(operation, path, isDryRun, alreadyDeleted));
  }

  stopRule(violation: StopRuleViolation, mode: ViolationMode): void {
    const message = '\n' + formatStopRuleViolation(violation, mode);

    // Stop rules are always critical
    if (mode === 'error') this.error(message, 'critical');
    else this.warn(message, 'critical');
  }
}
