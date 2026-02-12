// ============================================================================
// Barrel Exports for Pipeline
// ============================================================================

// File loading
export type { FileLoaderOptions, FileLoaderResult, FileMap } from './fileLoader';
export { FileLoaderError, isFileLoaderError, loadFiles } from './fileLoader';

// File diff computation
export type { AddedFile, ChangedFile, FileDiffResult, ProcessYamlOptions } from './fileDiff';
export { computeFileDiff, FileDiffError, getSkipPathsForFile, isFileDiffError } from './fileDiff';

// File updating
export type { FileOperationOptions, FileUpdateError, UpdateFileOptions } from './fileUpdater';
export { FileUpdaterError, isFileUpdaterError, updateFiles } from './fileUpdater';

// YAML formatting
export { formatYaml, isYamlFormatterError, YamlFormatterError } from './yamlFormatter';

// Stop rules validation
export type { StopRuleViolation, ValidationContext, ValidationResult } from './stopRulesValidator';
export { isStopRulesValidatorError, StopRulesValidatorError, validateStopRules } from './stopRulesValidator';

// Pattern usage validation
export type { PatternUsageResult, PatternUsageWarning } from './patternUsageValidator';
export { validatePatternUsage } from './patternUsageValidator';
