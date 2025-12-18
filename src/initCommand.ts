import { existsSync, writeFileSync } from 'node:fs';

import chalk from 'chalk';

import { createErrorClass, createErrorTypeGuard, ErrorOptions } from './utils/errors';

// ============================================================================
// Config Template
// ============================================================================

const CONFIG_TEMPLATE = String.raw`# HelmEnvDelta Configuration
# Environment-aware YAML delta and sync for GitOps workflows

# Source and destination folders (required)
source: "./path/to/source"          # Replace with your source environment folder (e.g., "./uat")
destination: "./path/to/destination" # Replace with your destination environment folder (e.g., "./prod")

# File selection patterns (optional, defaults to all files)
include:
  - "**/*.yaml"   # Include all YAML files
  - "**/*.yml"    # Include all YML files
exclude:
  - "**/skip*.yaml"  # Exclude files matching this pattern
  - "**/.git/**"     # Exclude git folders

# Remove files in destination not present in source (optional, default: false)
prune: false

# JSON paths to skip during sync - preserves environment-specific values (optional)
# Key: Glob pattern matching files
# Value: Array of JSONPath expressions to skip
skipPath:
  "apps/*.yaml":
    - "apiVersion"                          # Skip this field entirely
    - "spec.destination.namespace"          # Skip nested field
    - "spec.ignoreDifferences[*].kind"      # Skip array elements (wildcard support)
    - "spec.ignoreDifferences[*].jsonPointers"

  "svc/**/Chart.yaml":
    - "annotations.createdAt"
    - "annotations.lastModified"

  "svc/**/values.yaml":
    - "annotations.createdAt"
    - "annotations.lastModified"

# Output formatting options (optional)
outputFormat:
  indent: 2              # YAML indentation (default: 2)
  keySeparator: true     # Add blank lines between top-level keys (default: false)

  # Force quote specific values (supports wildcards)
  quoteValues:
    "svc/**/values.yaml":
      - "microservice.env[*].value"  # Quote all env variable values

  # Custom key ordering (JSONPath-style paths)
  keyOrders:
    "apps/*.yaml":
      - "apiVersion"
      - "kind"
      - "metadata.namespace"
      - "metadata.name"
      - "spec.project"
      - "spec.source"
      - "spec.destination"

    "svc/**/Chart.yaml":
      - "apiVersion"
      - "name"
      - "description"
      - "version"
      - "dependencies"

    "svc/**/values.yaml":
      - "microservice.nameOverride"
      - "microservice.image"
      - "microservice.replicaCount"
      - "microservice.env"
      - "microservice.env.[*].name"
      - "microservice.service"
      - "microservice.serviceAccount"
      - "microservice.resources"

  # Sort arrays by field name
  arraySort:
    "svc/**/values.yaml":
      - path: "microservice.env"
        sortBy: "name"
        order: "asc"  # or "desc"

# Validation rules to block dangerous changes (optional)
# Prevents sync operation if rules are violated (use --force to override)
stopRules:
  "apps/*.yaml":
    - type: "semverMajorUpgrade"
      path: "version"  # Block major version bumps (e.g., 1.x.x -> 2.0.0)

  "svc/**/Chart.yaml":
    - type: "semverDowngrade"
      path: "version"  # Block major version downgrades (e.g., 2.x.x -> 1.0.0)
    - type: "regex"
      path: "version"
      regex: "^1\\."  # Block versions starting with "1."

  "svc/**/values.yaml":
    - type: "numeric"
      path: "replicaCount"
      min: 2   # Minimum replicas
      max: 10  # Maximum replicas
    - type: "regex"
      path: "image.tag"
      regex: "^v0\\."  # Block v0.x tags in production

# Find/replace transformations - applies to ALL string values in matched files
# Pattern: File glob (like skipPath, stopRules), NOT JSONPath
# transforms:
#   "svc/**/values.yaml":
#     - find: "uat-db\\\\.(.+)\\\\.internal"  # Regex with escaped dots
#       replace: "prod-db.$1.internal"        # Capture group $1
#     - find: "uat-redis"                     # Simple string replacement
#       replace: "prod-redis"
#
#   "apps/*.yaml":
#     - find: "^uat-"                         # Prefix replacement
#       replace: "prod-"
#
#   "config/*.yaml":
#     - find: "debug"                         # Replace debug with info
#       replace: "info"
`;

// ============================================================================
// Error Handling
// ============================================================================

const InitErrorClass = createErrorClass('Init Command Error', {
  EEXIST: 'File already exists',
  ENOENT: 'Directory not found',
  EACCES: 'Permission denied',
  EISDIR: 'Path is a directory, not a file'
});

export class InitError extends InitErrorClass {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.message += '\n  Hint: Choose a different path or remove the existing file';
  }
}
export const isInitError = createErrorTypeGuard(InitError);

// ============================================================================
// Template Generation
// ============================================================================

export const generateConfigTemplate = (): string => CONFIG_TEMPLATE;

// ============================================================================
// Init Command Execution
// ============================================================================

export const executeInit = (outputPath: string): void => {
  // Check if file already exists
  if (existsSync(outputPath)) throw new InitError('Config file already exists', { code: 'EEXIST', path: outputPath });

  // Generate template
  const template = generateConfigTemplate();

  // Write to file
  try {
    writeFileSync(outputPath, template, 'utf8');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      throw new InitError('Failed to write config file', { code: nodeError.code, path: outputPath, cause: nodeError });
    }
    throw new InitError('Failed to write config file', { path: outputPath, cause: error as Error });
  }

  // Success message
  console.log(chalk.green(`\n✓ Configuration file created: ${outputPath}`));
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.gray(`    1. Edit ${outputPath} and update source/destination paths`));
  console.log(chalk.gray('    2. Customize skipPath, outputFormat, and stopRules as needed'));
  console.log(chalk.gray(`    3. Run: helm-env-delta --config ${outputPath}\n`));
};
