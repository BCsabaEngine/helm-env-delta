// ============================================================================
// Barrel Exports for Reporters
// ============================================================================

// Array differ
export type { ArrayDiffResult } from './arrayDiffer';
export { diffArrays, findArrayPaths, hasArrays } from './arrayDiffer';

// Console diff reporter
export { showConsoleDiff } from './consoleDiffReporter';

// HTML reporter
export type { DiffStats, ReportMetadata } from './htmlReporter';
export { generateHtmlReport, HtmlReporterError, isHtmlReporterError } from './htmlReporter';

// JSON reporter
export type {
  AddedFileDetail,
  ChangedFileDetail,
  FieldChange,
  JsonReport,
  JsonReportFiles,
  JsonReportMetadata,
  JsonReportSummary,
  StopRuleViolationJson
} from './jsonReporter';
export { generateJsonReport, isJsonReporterError, JsonReporterError } from './jsonReporter';

// HTML template
export type { HtmlStopRuleViolation } from './htmlTemplate';
export { generateHtmlTemplate } from './htmlTemplate';

// HTML styles
export { DIFF2HTML_STYLES, HTML_STYLES, TAB_SCRIPT } from './htmlStyles';

// Tree builder
export type { TreeNode } from './treeBuilder';
export { buildFileTree } from './treeBuilder';

// Tree renderer
export { escapeHtml, renderSidebarTree, renderTreeview } from './treeRenderer';

// Browser launcher
export { BrowserLauncherError, isBrowserLauncherError, openInBrowser } from './browserLauncher';
