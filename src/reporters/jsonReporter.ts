import { Config } from '../config';
import { AddedFile, ChangedFile, FileDiffResult, ValidationResult } from '../pipeline';
import { deepEqual } from '../utils/deepEqual';
import { generateUnifiedDiff } from '../utils/diffGenerator';
import { createErrorClass, createErrorTypeGuard } from '../utils/errors';

// ============================================================================
// Error Handling
// ============================================================================

const JsonReporterErrorClass = createErrorClass('JSON Reporter Error', {});

export class JsonReporterError extends JsonReporterErrorClass {}
export const isJsonReporterError = createErrorTypeGuard(JsonReporterError);

// ============================================================================
// Types
// ============================================================================

export interface JsonReportMetadata {
  timestamp: string;
  source: string;
  destination: string;
  dryRun: boolean;
  version: string;
}

export interface JsonReportSummary {
  added: number;
  deleted: number;
  changed: number;
  formatted: number;
  unchanged: number;
}

export interface FieldChange {
  path: string;
  oldValue: unknown;
  updatedValue: unknown;
}

export interface ChangedFileDetail {
  path: string;
  diff: string;
  changes: FieldChange[];
}

export interface AddedFileDetail {
  path: string;
  originalPath?: string;
  content: string;
}

export interface JsonReportFiles {
  added: AddedFileDetail[];
  deleted: string[];
  changed: ChangedFileDetail[];
  formatted: string[];
  unchanged: string[];
}

export interface StopRuleViolationJson {
  file: string;
  rule: {
    type: string;
    path?: string;
  };
  path: string;
  oldValue: unknown;
  updatedValue: unknown;
  message: string;
}

export interface JsonReport {
  metadata: JsonReportMetadata;
  summary: JsonReportSummary;
  files: JsonReportFiles;
  stopRuleViolations: StopRuleViolationJson[];
}

// ============================================================================
// Helper Functions
// ============================================================================

const isPrimitive = (value: unknown): boolean => value === undefined || value === null || typeof value !== 'object';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const formatJsonPath = (path: string[]): string => {
  if (path.length === 0) return '$';
  return `$.${path.join('.')}`;
};

const detectDeepChanges = (oldData: unknown, updatedData: unknown, currentPath: string[] = []): FieldChange[] => {
  const changes: FieldChange[] = [];

  // Base case: both are primitives or one is primitive
  if (isPrimitive(oldData) || isPrimitive(updatedData)) {
    if (!deepEqual(oldData, updatedData))
      changes.push({
        path: formatJsonPath(currentPath),
        oldValue: oldData,
        updatedValue: updatedData
      });

    return changes;
  }

  // Arrays: report array-level change if items differ
  if (Array.isArray(oldData) && Array.isArray(updatedData)) {
    if (!deepEqual(oldData, updatedData))
      changes.push({
        path: formatJsonPath(currentPath),
        oldValue: `Array with ${oldData.length} item(s)`,
        updatedValue: `Array with ${updatedData.length} item(s)`
      });

    return changes;
  }

  // Type mismatch between array and object
  if (Array.isArray(oldData) !== Array.isArray(updatedData)) {
    changes.push({
      path: formatJsonPath(currentPath),
      oldValue: Array.isArray(oldData) ? `Array with ${oldData.length} item(s)` : oldData,
      updatedValue: Array.isArray(updatedData) ? `Array with ${updatedData.length} item(s)` : updatedData
    });
    return changes;
  }

  // Objects: recurse into keys
  if (isObject(oldData) && isObject(updatedData)) {
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(updatedData)]);

    for (const key of allKeys) {
      const oldValue = oldData[key];
      const updatedValue = updatedData[key];

      const subChanges = detectDeepChanges(oldValue, updatedValue, [...currentPath, key]);

      changes.push(...subChanges);
    }
  }

  return changes;
};

const generateChangedFileDetail = (file: ChangedFile): ChangedFileDetail => {
  const diff = generateUnifiedDiff(file.path, file.destinationContent, file.sourceContent);

  const changes = detectDeepChanges(file.processedDestContent, file.processedSourceContent);

  return {
    path: file.path,
    diff,
    changes
  };
};

// ============================================================================
// Main Function
// ============================================================================

export const generateJsonReport = (
  diffResult: FileDiffResult,
  formattedFiles: string[],
  validationResult: ValidationResult,
  config: Config,
  dryRun: boolean,
  version: string
): void => {
  try {
    const metadata: JsonReportMetadata = {
      timestamp: new Date().toISOString(),
      source: config.source,
      destination: config.destination,
      dryRun,
      version
    };

    const summary: JsonReportSummary = {
      added: diffResult.addedFiles.length,
      deleted: diffResult.deletedFiles.length,
      changed: diffResult.changedFiles.length,
      formatted: formattedFiles.length,
      unchanged: diffResult.unchangedFiles.length
    };

    const changedFileDetails = diffResult.changedFiles.map((file) => generateChangedFileDetail(file));

    const addedFileDetails: AddedFileDetail[] = diffResult.addedFiles.map((file: AddedFile) => ({
      path: file.path,
      originalPath: file.originalPath,
      content: file.processedContent
    }));

    const files: JsonReportFiles = {
      added: addedFileDetails,
      deleted: diffResult.deletedFiles,
      changed: changedFileDetails,
      formatted: formattedFiles,
      unchanged: diffResult.unchangedFiles
    };

    const stopRuleViolations: StopRuleViolationJson[] = validationResult.violations.map((violation) => ({
      file: violation.file,
      rule: {
        type: violation.rule.type,
        path: violation.rule.path
      },
      path: violation.path,
      oldValue: violation.oldValue,
      updatedValue: violation.updatedValue,
      message: violation.message
    }));

    const report: JsonReport = {
      metadata,
      summary,
      files,
      stopRuleViolations
    };

    console.log(JSON.stringify(report, undefined, 2));
  } catch (error: unknown) {
    if (error instanceof Error)
      throw new JsonReporterError('Failed to generate JSON report', {
        cause: error
      });

    throw new JsonReporterError('Failed to generate JSON report');
  }
};
