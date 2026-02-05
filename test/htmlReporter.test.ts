import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock('node:crypto', () => ({
  randomBytes: vi.fn()
}));

vi.mock('open', () => ({
  default: vi.fn()
}));

vi.mock('diff2html', () => ({
  html: vi.fn()
}));

vi.mock('../src/arrayDiffer', () => ({
  diffArrays: vi.fn(),
  findArrayPaths: vi.fn(),
  hasArrays: vi.fn()
}));

vi.mock('../src/utils/diffGenerator', () => ({
  generateUnifiedDiff: vi.fn()
}));

vi.mock('../src/utils/fileType', () => ({
  isYamlFile: vi.fn()
}));

vi.mock('../src/utils/serialization', () => ({
  serializeForDiff: vi.fn(),
  normalizeForComparison: vi.fn()
}));

vi.mock('../src/utils/deepEqual', () => ({
  deepEqual: vi.fn()
}));

vi.mock('../src/utils/jsonPath', () => ({
  getValueAtPath: vi.fn()
}));

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { html as diff2html } from 'diff2html';
import open from 'open';

import { diffArrays, findArrayPaths, hasArrays } from '../src/arrayDiffer';
import { Config } from '../src/configFile';
import { AddedFile, ChangedFile, FileDiffResult } from '../src/fileDiff';
import { generateHtmlReport, HtmlReporterError, isHtmlReporterError } from '../src/htmlReporter';
import { Logger } from '../src/logger';
import { deepEqual } from '../src/utils/deepEqual';
import { generateUnifiedDiff } from '../src/utils/diffGenerator';
import { isYamlFile } from '../src/utils/fileType';
import { getValueAtPath } from '../src/utils/jsonPath';
import { normalizeForComparison, serializeForDiff } from '../src/utils/serialization';

// Helper to create a mock logger
const createMockLogger = (): Logger => {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    progress: vi.fn(),
    fileOp: vi.fn(),
    stopRule: vi.fn(),
    shouldShow: vi.fn(() => true)
  } as unknown as Logger;
};

const createMockChangedFile = (overrides?: Partial<ChangedFile>): ChangedFile => ({
  path: 'test.yaml',
  sourceContent: 'version: 1.0.0',
  destinationContent: 'version: 0.9.0',
  processedSourceContent: { version: '1.0.0' },
  processedDestContent: { version: '0.9.0' },
  rawParsedSource: { version: '1.0.0' },
  rawParsedDest: { version: '0.9.0' },
  skipPaths: [],
  ...overrides
});

const createMockAddedFile = (path: string, overrides?: Partial<AddedFile>): AddedFile => ({
  path,
  content: `name: ${path}\nversion: 1.0.0`,
  processedContent: `name: ${path}\nversion: 1.0.0`,
  ...overrides
});

const createMockDiffResult = (overrides?: Partial<FileDiffResult>): FileDiffResult => ({
  addedFiles: [],
  deletedFiles: [],
  changedFiles: [],
  unchangedFiles: [],
  ...overrides
});

const createMockConfig = (overrides?: Partial<Config>): Config => ({
  source: './src',
  destination: './dest',
  include: ['**/*'],
  exclude: [],
  ...overrides
});

describe('htmlReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(randomBytes).mockReturnValue(Buffer.from('a1b2c3d4e5f6g7h8'));
    vi.mocked(mkdir).mockResolvedValue();
    vi.mocked(writeFile).mockResolvedValue();
    vi.mocked(open).mockResolvedValue();
    vi.mocked(diff2html).mockReturnValue('<div>mocked diff</div>');
    vi.mocked(isYamlFile).mockReturnValue(true);
    vi.mocked(serializeForDiff).mockReturnValue('mocked serialized content');
    vi.mocked(generateUnifiedDiff).mockReturnValue('mocked unified diff');
    vi.mocked(hasArrays).mockReturnValue(false);
    vi.mocked(findArrayPaths).mockReturnValue([]);
    vi.mocked(diffArrays).mockReturnValue({ added: [], removed: [], unchanged: [] });
    vi.mocked(normalizeForComparison).mockImplementation((value) => value);
    vi.mocked(deepEqual).mockReturnValue(true);
    vi.mocked(getValueAtPath).mockReturnValue();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Error Classes', () => {
    it('should create HtmlReporterError with message', () => {
      const error1 = new HtmlReporterError('Test error');
      expect(error1).toBeInstanceOf(Error);
      expect(error1.name).toBe('HTML Reporter Error');
      expect(error1.message).toContain('Test error');
    });

    it('should create HtmlReporterError with error code', () => {
      const error1 = new HtmlReporterError('Write failed', {
        code: 'WRITE_FAILED',
        path: '/tmp/report.html'
      });
      expect(error1.message).toContain('Failed to write HTML report file');
      expect(error1.code).toBe('WRITE_FAILED');
      expect(error1.path).toBe('/tmp/report.html');
    });

    it('should create HtmlReporterError with cause', () => {
      const cause = new Error('Original error');
      const error1 = new HtmlReporterError('Wrapper error', {
        code: 'WRITE_FAILED',
        cause
      });
      expect(error1.cause).toBe(cause);
    });

    it('should support WRITE_FAILED error code', () => {
      const error1 = new HtmlReporterError('Test', { code: 'WRITE_FAILED' });
      expect(error1.code).toBe('WRITE_FAILED');
    });

    it('should support BROWSER_OPEN_FAILED error code', () => {
      const error1 = new HtmlReporterError('Test', { code: 'BROWSER_OPEN_FAILED' });
      expect(error1.code).toBe('BROWSER_OPEN_FAILED');
    });

    it('should support DIFF_GENERATION_FAILED error code', () => {
      const error1 = new HtmlReporterError('Test', { code: 'DIFF_GENERATION_FAILED' });
      expect(error1.code).toBe('DIFF_GENERATION_FAILED');
    });

    it('should support INVALID_OUTPUT_PATH error code', () => {
      const error1 = new HtmlReporterError('Test', { code: 'INVALID_OUTPUT_PATH' });
      expect(error1.code).toBe('INVALID_OUTPUT_PATH');
    });

    it('should allow isHtmlReporterError to return true for HtmlReporterError', () => {
      const error1 = new HtmlReporterError('Test');
      expect(isHtmlReporterError(error1)).toBe(true);
    });

    it('should allow isHtmlReporterError to return false for regular Error', () => {
      const error1 = new Error('Test');
      expect(isHtmlReporterError(error1)).toBe(false);
    });

    it('should allow isHtmlReporterError to return false for non-error values', () => {
      expect(isHtmlReporterError()).toBe(false);
      expect(isHtmlReporterError('error')).toBe(false);
      expect(isHtmlReporterError(42)).toBe(false);
    });

    it('should handle error without options', () => {
      const error1 = new HtmlReporterError('Test error');
      expect(error1.message).toContain('Test error');
      expect(error1.code).toBeUndefined();
    });

    it('should handle error with partial options', () => {
      const error1 = new HtmlReporterError('Test', { code: 'WRITE_FAILED' });
      expect(error1.code).toBe('WRITE_FAILED');
      expect(error1.path).toBeUndefined();
    });

    it('should format error message with code', () => {
      const error1 = new HtmlReporterError('Failed to write', {
        code: 'WRITE_FAILED',
        path: '/tmp/test.html'
      });
      expect(error1.message).toContain('Failed to write HTML report file');
      expect(error1.message).toContain('Failed to write');
    });

    it('should include path in error details', () => {
      const error1 = new HtmlReporterError('Test', {
        code: 'WRITE_FAILED',
        path: '/custom/path.html'
      });
      expect(error1.path).toBe('/custom/path.html');
    });
  });

  describe('generateHtmlReport', () => {
    it('should generate temp file path', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(writeFile).toHaveBeenCalled();
      const writePath = vi.mocked(writeFile).mock.calls[0][0] as string;
      expect(writePath).toContain('helm-env-delta');
      expect(writePath).toContain('.html');
    });

    it('should create report metadata with timestamp', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(writeFile).toHaveBeenCalled();
      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('2024-01-15T10:30:00.000Z');
    });

    it('should create report metadata with source', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig({ source: './custom-src' });

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('./custom-src');
    });

    it('should create report metadata with destination', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig({ destination: './custom-dest' });

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('./custom-dest');
    });

    it('should create report metadata with dryRun true', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, true, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('DRY RUN');
    });

    it('should create report metadata with dryRun false', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).not.toContain('DRY RUN');
    });

    it('should separate truly unchanged from formatted files', async () => {
      const diffResult = createMockDiffResult({
        unchangedFiles: ['file1.yaml', 'file2.yaml', 'file3.yaml']
      });
      const formattedFiles = ['file2.yaml'];
      const config = createMockConfig();

      await generateHtmlReport(diffResult, formattedFiles, config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('2 Unchanged');
    });

    it('should generate changed file sections for all changed files', async () => {
      const changedFile = createMockChangedFile({ path: 'changed.yaml' });
      const diffResult = createMockDiffResult({
        changedFiles: [changedFile]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(serializeForDiff).toHaveBeenCalled();
      expect(generateUnifiedDiff).toHaveBeenCalled();
      expect(diff2html).toHaveBeenCalled();
    });

    it('should generate HTML template with all data', async () => {
      const diffResult = createMockDiffResult({
        addedFiles: [createMockAddedFile('new.yaml')],
        deletedFiles: ['old.yaml'],
        changedFiles: [createMockChangedFile()],
        unchangedFiles: ['same.yaml']
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('1 Added');
      expect(htmlContent).toContain('1 Changed');
      expect(htmlContent).toContain('1 Deleted');
    });

    it('should write HTML file', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    it('should log success message with file path', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();
      const mockLogger = createMockLogger();

      await generateHtmlReport(diffResult, [], config, false, mockLogger);

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('✓ HTML report generated'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('opening in browser'));
    });

    it('should open report in browser', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(open).toHaveBeenCalled();
    });

    it('should complete successfully when all steps succeed', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await expect(generateHtmlReport(diffResult, [], config, false, createMockLogger())).resolves.toBeUndefined();
    });

    it('should catch browser open errors gracefully', async () => {
      vi.mocked(open).mockRejectedValue(new Error('Browser not found'));
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await expect(generateHtmlReport(diffResult, [], config, false, createMockLogger())).resolves.toBeUndefined();
    });

    it('should log manual open instructions when browser fails', async () => {
      vi.mocked(open).mockRejectedValue(new Error('Browser not found'));
      const diffResult = createMockDiffResult();
      const config = createMockConfig();
      const mockLogger = createMockLogger();

      await generateHtmlReport(diffResult, [], config, false, mockLogger);

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Could not open browser'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('file://'));
    });

    it('should continue execution even if browser open fails', async () => {
      vi.mocked(open).mockRejectedValue(new Error('Browser not found'));
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await expect(generateHtmlReport(diffResult, [], config, false, createMockLogger())).resolves.toBeUndefined();
      expect(writeFile).toHaveBeenCalled();
    });

    it('should handle empty diff results', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('0 Added');
      expect(htmlContent).toContain('0 Changed');
      expect(htmlContent).toContain('0 Deleted');
    });

    it('should handle files in formatted but not unchanged', async () => {
      const diffResult = createMockDiffResult({
        unchangedFiles: ['file1.yaml']
      });
      const formattedFiles = ['file2.yaml'];
      const config = createMockConfig();

      await generateHtmlReport(diffResult, formattedFiles, config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('1 Formatted');
      expect(htmlContent).toContain('1 Unchanged');
    });

    it('should handle files in both formatted and unchanged', async () => {
      const diffResult = createMockDiffResult({
        unchangedFiles: ['file1.yaml', 'file2.yaml']
      });
      const formattedFiles = ['file1.yaml'];
      const config = createMockConfig();

      await generateHtmlReport(diffResult, formattedFiles, config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('1 Formatted');
      expect(htmlContent).toContain('1 Unchanged');
    });

    it('should call all functions in correct order', async () => {
      const diffResult = createMockDiffResult({
        changedFiles: [createMockChangedFile()]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(randomBytes).toHaveBeenCalled();
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(open).toHaveBeenCalled();
    });

    it('should pass correct parameters between functions', async () => {
      const changedFile = createMockChangedFile({ path: 'test-file.yaml' });
      const diffResult = createMockDiffResult({
        changedFiles: [changedFile]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      expect(generateUnifiedDiff).toHaveBeenCalledWith('test-file.yaml', expect.any(String), expect.any(String));
    });

    it('should display transformed filename with original when originalPath is set', async () => {
      const changedFile = createMockChangedFile({
        path: 'envs/prod/app.yaml',
        originalPath: 'envs/uat/app.yaml'
      });
      const diffResult = createMockDiffResult({
        changedFiles: [changedFile]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('envs/uat/app.yaml');
      expect(htmlContent).toContain('envs/prod/app.yaml');
      expect(htmlContent).toContain('→');
      expect(htmlContent).toContain('filename-transform');
    });

    it('should display only path when no filename transform occurred', async () => {
      const changedFile = createMockChangedFile({
        path: 'config/app.yaml'
        // No originalPath set
      });
      const diffResult = createMockDiffResult({
        changedFiles: [changedFile]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('<summary>config/app.yaml');
      // Should not have the span with transform class wrapping the filename
      expect(htmlContent).not.toContain('<span class="filename-transform">');
    });

    it('should include treeview classes in added files section', async () => {
      const diffResult = createMockDiffResult({
        addedFiles: [createMockAddedFile('src/new.yaml'), createMockAddedFile('config/app.yaml')]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      // Added files section now has sidebar layout with content display
      expect(htmlContent).toContain('class="sidebar-container"');
      expect(htmlContent).toContain('Added Files');
      expect(htmlContent).toContain('class="added-content"');
      expect(htmlContent).toContain('class="file-content"');
      expect(htmlContent).toContain('class="copy-btn"');
      expect(htmlContent).toContain('class="download-btn"');
    });

    it('should include sidebar in changed files section', async () => {
      const changedFile = createMockChangedFile({ path: 'test.yaml' });
      const diffResult = createMockDiffResult({
        changedFiles: [changedFile]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('class="sidebar-container"');
      expect(htmlContent).toContain('class="sidebar"');
      expect(htmlContent).toContain('class="sidebar-header"');
      expect(htmlContent).toContain('Changed Files');
    });

    it('should include data-file-id attributes on changed file sections', async () => {
      const changedFile = createMockChangedFile({ path: 'test.yaml' });
      const diffResult = createMockDiffResult({
        changedFiles: [changedFile]
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('data-file-id="file-0"');
      expect(htmlContent).toContain('id="file-0"');
    });

    it('should include tree toggle JavaScript', async () => {
      const diffResult = createMockDiffResult();
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('tree-folder');
      expect(htmlContent).toContain('tree-toggle');
    });

    it('should render treeview for unchanged files', async () => {
      const diffResult = createMockDiffResult({
        unchangedFiles: ['src/app.yaml', 'lib/utils.yaml']
      });
      const config = createMockConfig();

      await generateHtmlReport(diffResult, [], config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('tree-root');
    });

    it('should render treeview for formatted files', async () => {
      const diffResult = createMockDiffResult({
        unchangedFiles: ['src/app.yaml']
      });
      const formattedFiles = ['src/app.yaml'];
      const config = createMockConfig();

      await generateHtmlReport(diffResult, formattedFiles, config, false, createMockLogger());

      const htmlContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(htmlContent).toContain('1 Formatted');
    });
  });
});
