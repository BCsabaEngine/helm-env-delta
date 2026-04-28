import colors from 'ansi-colors';

import { type StopRuleViolation } from './pipeline/stopRulesValidator';

// ============================================================================
// Types
// ============================================================================

export type BoxStyle = 'success' | 'warning' | 'error' | 'info';
export type ProgressStyle = 'loading' | 'success' | 'info';
export type ViolationMode = 'error' | 'warning' | 'force';
export type FileOperation = 'add' | 'update' | 'delete' | 'format';

// ============================================================================
// Generic Box Formatter
// ============================================================================

export const formatBox = (title: string, content: string[], style: BoxStyle = 'info', width: number = 60): string => {
  const getColorFunction = (boxStyle: BoxStyle) => {
    switch (boxStyle) {
      case 'success':
        return colors.green;
      case 'warning':
        return colors.yellow;
      case 'error':
        return colors.red;
      default:
        return colors.cyan;
    }
  };

  const colorFunction = getColorFunction(style);
  const titlePadding = width - title.length - 4;
  const topBorder = colorFunction(`╭─ ${title} ${'─'.repeat(Math.max(0, titlePadding - 8))}╮`);
  const bottomBorder = colorFunction(`╰${'─'.repeat(width - 9)}╯`);

  const contentLines = content.map((line) => {
    const paddedLine = line.padEnd(width - 2);
    return colorFunction(`│ ${paddedLine} │`);
  });

  return `${topBorder}\n${contentLines.join('\n')}\n${bottomBorder}`;
};

// ============================================================================
// Stop Rule Violation Formatter
// ============================================================================

export const formatStopRuleViolation = (violation: StopRuleViolation, mode: ViolationMode): string => {
  const getModeTitle = (violationMode: ViolationMode): string => {
    switch (violationMode) {
      case 'error':
        return 'Stop Rule Violation';
      case 'warning':
        return 'Stop Rule Violation (Dry Run)';
      case 'force':
        return 'Stop Rule Violation (--force)';
    }
  };

  const getBoxStyle = (violationMode: ViolationMode): BoxStyle => {
    return violationMode === 'error' ? 'error' : 'warning';
  };

  const labelWidth = 10;
  const formatLabel = (label: string): string => colors.dim(label.padEnd(labelWidth));

  const content: string[] = [
    `${formatLabel('File:')} ${violation.file}`,
    `${formatLabel('Path:')} ${violation.path}`,
    `${formatLabel('Rule:')} ${violation.rule.type}`,
    `${formatLabel('Message:')} ${violation.message}`
  ];

  if (violation.oldValue !== undefined) content.push(`${formatLabel('Old Value:')} ${violation.oldValue}`);

  content.push(`${formatLabel('New Value:')} ${violation.updatedValue}`);

  return formatBox(getModeTitle(mode), content, getBoxStyle(mode), 70);
};

// ============================================================================
// File Operation Colorizer
// ============================================================================

export const colorizeFileOperation = (
  operation: FileOperation,
  filePath: string,
  isDryRun: boolean,
  alreadyDeleted: boolean = false
): string => {
  const getOperationDisplay = (op: FileOperation): { symbol: string; verb: string; colorFn: typeof colors.green } => {
    switch (op) {
      case 'add':
        return { symbol: '+', verb: 'add', colorFn: colors.green };
      case 'update':
        return { symbol: '~', verb: 'update', colorFn: colors.yellow };
      case 'delete':
        return { symbol: '-', verb: 'delete', colorFn: colors.red };
      case 'format':
        return { symbol: '≈', verb: 'format', colorFn: colors.cyan };
    }
  };

  const { symbol, verb, colorFn } = getOperationDisplay(operation);

  if (isDryRun) return `[DRY RUN] Would ${verb}: ${colorFn(filePath)}`;

  const suffix = alreadyDeleted ? ' (already deleted)' : '';
  return colorFn(`  ${symbol} ${filePath}${suffix}`);
};

// ============================================================================
// Progress Message Formatter
// ============================================================================

export const formatProgressMessage = (message: string, style: ProgressStyle): string => {
  const getIcon = (progressStyle: ProgressStyle): string => {
    switch (progressStyle) {
      case 'loading':
        return '⏳';
      case 'success':
        return '✓';
      default:
        return 'ℹ';
    }
  };

  const getColorFunction = (progressStyle: ProgressStyle) => {
    switch (progressStyle) {
      case 'success':
        return colors.green;
      default:
        return colors.cyan;
    }
  };

  const icon = getIcon(style);
  const colorFunction = getColorFunction(style);

  return colorFunction(`${icon} ${message}`);
};
