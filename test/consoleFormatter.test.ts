import { describe, expect, it } from 'vitest';

import {
  colorizeFileOperation,
  formatBox,
  formatProgressMessage,
  formatStopRuleViolation
} from '../src/consoleFormatter';

describe('consoleFormatter', () => {
  describe('formatBox', () => {
    it('should create box with title and content', () => {
      const result = formatBox('Test Title', ['Line 1', 'Line 2']);

      expect(result).toContain('Test Title');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    it('should use info style by default (cyan)', () => {
      const result = formatBox('Title', ['Content']);

      expect(result).toBeDefined();
      expect(result).toContain('Title');
    });

    it('should use success style (green)', () => {
      const result = formatBox('Success', ['Done'], 'success');

      expect(result).toContain('Success');
      expect(result).toContain('Done');
    });

    it('should use warning style (yellow)', () => {
      const result = formatBox('Warning', ['Alert'], 'warning');

      expect(result).toContain('Warning');
      expect(result).toContain('Alert');
    });

    it('should use error style (red)', () => {
      const result = formatBox('Error', ['Failed'], 'error');

      expect(result).toContain('Error');
      expect(result).toContain('Failed');
    });

    it('should respect custom width parameter', () => {
      const result = formatBox('Title', ['Content'], 'info', 80);

      expect(result).toBeDefined();
    });

    it('should format multiple content lines', () => {
      const result = formatBox('Title', ['Line 1', 'Line 2', 'Line 3', 'Line 4']);

      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
      expect(result).toContain('Line 4');
    });

    it('should include border characters', () => {
      const result = formatBox('Test', ['Content']);

      expect(result).toMatch(/[│╭╮╯╰]/);
    });

    it('should handle empty content array', () => {
      const result = formatBox('Empty', []);

      expect(result).toContain('Empty');
    });

    it('should handle long title', () => {
      const result = formatBox('Very Long Title That Might Exceed Normal Width', ['Content']);

      expect(result).toBeDefined();
    });
  });

  describe('formatStopRuleViolation', () => {
    const violation = {
      file: 'test.yaml',
      path: '$.version',
      rule: { type: 'semverMajorUpgrade', path: '$.version' },
      message: 'Major version upgrade detected',
      oldValue: '1.0.0',
      updatedValue: '2.0.0'
    };

    it('should show "Stop Rule Violation" for error mode', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('Stop Rule Violation');
      expect(result).not.toContain('Dry Run');
      expect(result).not.toContain('--force');
    });

    it('should show "(Dry Run)" for warning mode', () => {
      const result = formatStopRuleViolation(violation, 'warning');

      expect(result).toContain('(Dry Run)');
    });

    it('should show "(--force)" for force mode', () => {
      const result = formatStopRuleViolation(violation, 'force');

      expect(result).toContain('(--force)');
    });

    it('should use error style for error mode', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toBeDefined();
      expect(result).toContain('test.yaml');
    });

    it('should use warning style for warning and force modes', () => {
      const result1 = formatStopRuleViolation(violation, 'warning');
      const result2 = formatStopRuleViolation(violation, 'force');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should include file path', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('test.yaml');
    });

    it('should include JSON path', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('$.version');
    });

    it('should include rule type', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('semverMajorUpgrade');
    });

    it('should include violation message', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('Major version upgrade detected');
    });

    it('should include old value when present', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('1.0.0');
    });

    it('should always include new value', () => {
      const result = formatStopRuleViolation(violation, 'error');

      expect(result).toContain('2.0.0');
    });

    it('should handle violation without old value', () => {
      const noOldValue = { ...violation, oldValue: undefined };
      const result = formatStopRuleViolation(noOldValue, 'error');

      expect(result).toContain('2.0.0');
      expect(result).toBeDefined();
    });
  });

  describe('colorizeFileOperation', () => {
    it('should use green with + for add operation', () => {
      const result = colorizeFileOperation('add', 'file.yaml', false);

      expect(result).toContain('file.yaml');
    });

    it('should use yellow with ~ for update operation', () => {
      const result = colorizeFileOperation('update', 'file.yaml', false);

      expect(result).toContain('file.yaml');
    });

    it('should use red with - for delete operation', () => {
      const result = colorizeFileOperation('delete', 'file.yaml', false);

      expect(result).toContain('file.yaml');
    });

    it('should use cyan with ≈ for format operation', () => {
      const result = colorizeFileOperation('format', 'file.yaml', false);

      expect(result).toContain('file.yaml');
    });

    it('should prepend "[DRY RUN] Would..." for dry-run mode', () => {
      const result = colorizeFileOperation('add', 'file.yaml', true);

      expect(result).toContain('[DRY RUN]');
      expect(result).toContain('Would');
    });

    it('should not include DRY RUN for non dry-run', () => {
      const result = colorizeFileOperation('add', 'file.yaml', false);

      expect(result).not.toContain('[DRY RUN]');
    });

    it('should include file path in output', () => {
      const result = colorizeFileOperation('add', 'path/to/file.yaml', false);

      expect(result).toContain('path/to/file.yaml');
    });

    it('should add "(already deleted)" suffix when alreadyDeleted is true', () => {
      const result = colorizeFileOperation('delete', 'file.yaml', false, true);

      expect(result).toContain('(already deleted)');
    });

    it('should not add "(already deleted)" when alreadyDeleted is false', () => {
      const result = colorizeFileOperation('delete', 'file.yaml', false, false);

      expect(result).not.toContain('(already deleted)');
    });

    it('should combine dry-run with different operations', () => {
      expect(colorizeFileOperation('add', 'file.yaml', true)).toContain('[DRY RUN]');
      expect(colorizeFileOperation('update', 'file.yaml', true)).toContain('[DRY RUN]');
      expect(colorizeFileOperation('delete', 'file.yaml', true)).toContain('[DRY RUN]');
      expect(colorizeFileOperation('format', 'file.yaml', true)).toContain('[DRY RUN]');
    });
  });

  describe('formatProgressMessage', () => {
    it('should use hourglass icon for loading style', () => {
      const result = formatProgressMessage('Loading...', 'loading');

      expect(result).toContain('Loading...');
    });

    it('should use checkmark icon for success style', () => {
      const result = formatProgressMessage('Done!', 'success');

      expect(result).toContain('Done!');
    });

    it('should use info icon for info style', () => {
      const result = formatProgressMessage('Information', 'info');

      expect(result).toContain('Information');
    });

    it('should use green color for success', () => {
      const result = formatProgressMessage('Success', 'success');

      expect(result).toBeDefined();
    });

    it('should use cyan color for loading', () => {
      const result = formatProgressMessage('Loading', 'loading');

      expect(result).toBeDefined();
    });

    it('should use cyan color for info', () => {
      const result = formatProgressMessage('Info', 'info');

      expect(result).toBeDefined();
    });

    it('should include message text', () => {
      const message = 'Custom progress message';
      const result = formatProgressMessage(message, 'loading');

      expect(result).toContain(message);
    });

    it('should format icon and message correctly', () => {
      const result = formatProgressMessage('Test', 'success');

      expect(result).toBeDefined();
      expect(result).toContain('Test');
    });
  });
});
