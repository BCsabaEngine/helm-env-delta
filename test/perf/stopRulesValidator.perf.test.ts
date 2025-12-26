import { bench, describe } from 'vitest';
import * as YAML from 'yaml';

import { validateStopRules } from '../../src/stopRulesValidator';
import { generateFileMap } from './fixtures/dataGenerator';

const generateChangedFiles = (count: number) => {
  const fileMap = generateFileMap(count, { size: 'small', complexity: 'flat' });
  const changedFiles = [];

  for (const [path, content] of fileMap) {
    const sourceContent = YAML.parse(content);
    const destinationContent = structuredClone(sourceContent);

    if (sourceContent && typeof sourceContent === 'object') {
      (sourceContent as Record<string, unknown>).image = { tag: 'v1.2.3' };
      (destinationContent as Record<string, unknown>).image = { tag: 'v1.5.0' };
    }

    changedFiles.push({
      path,
      sourceContent: YAML.stringify(sourceContent),
      destinationContent: YAML.stringify(destinationContent),
      processedSourceContent: sourceContent,
      processedDestContent: destinationContent
    });
  }

  return changedFiles;
};

describe('stopRulesValidator performance', () => {
  describe('Validation at scale', () => {
    bench('validate-100-files-5-rules', () => {
      const changedFiles = generateChangedFiles(50);
      const stopRules = {
        '**/*.yaml': [
          { type: 'semverMajorUpgrade' as const, path: 'image.tag' },
          { type: 'semverDowngrade' as const, path: 'version' },
          { type: 'versionFormat' as const, path: 'image.tag', vPrefix: 'required' as const },
          { type: 'numeric' as const, path: 'replicaCount', min: 2, max: 10 },
          { type: 'regex' as const, path: 'image.tag', regex: String.raw`^v0\.` }
        ]
      };

      try {
        validateStopRules(changedFiles, stopRules);
      } catch {
        // Expected to fail due to version changes
      }
    });

    bench('validate-1000-files-10-rules', () => {
      const changedFiles = generateChangedFiles(50);
      const stopRules = {
        '**/*.yaml': [
          { type: 'semverMajorUpgrade' as const, path: 'image.tag' },
          { type: 'semverDowngrade' as const, path: 'version' },
          { type: 'versionFormat' as const, path: 'image.tag', vPrefix: 'required' as const },
          { type: 'versionFormat' as const, path: 'version', vPrefix: 'forbidden' as const },
          { type: 'numeric' as const, path: 'replicaCount', min: 1, max: 20 },
          { type: 'numeric' as const, path: 'cpu', min: 100, max: 4000 },
          { type: 'regex' as const, path: 'image.tag', regex: String.raw`^v0\.` },
          { type: 'regex' as const, path: 'namespace', regex: 'default' },
          { type: 'semverMajorUpgrade' as const, path: 'dependencies[*].version' },
          { type: 'numeric' as const, path: 'memory', min: 256, max: 8192 }
        ]
      };

      try {
        validateStopRules(changedFiles, stopRules);
      } catch {
        // Expected to fail due to version changes
      }
    });
  });
});
