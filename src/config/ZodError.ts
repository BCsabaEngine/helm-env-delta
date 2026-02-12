import { z } from 'zod';

// Custom error class for Zod validation failures.
export class ZodValidationError extends Error {
  constructor(
    public readonly zodError: z.ZodError,
    public readonly sourcePath?: string
  ) {
    const errorMessage = ZodValidationError.formatError(zodError, sourcePath);
    super(errorMessage);
    this.name = 'ZodValidationError';
  }

  // Formats Zod validation errors into user-friendly messages
  private static formatError = (zodError: z.ZodError, sourcePath?: string): string => {
    const header = sourcePath ? `Validation failed in ${sourcePath}:\n` : 'Validation failed:\n';

    const errors = zodError.issues.map((error) => {
      const path = error.path.length > 0 ? error.path.join('.') : 'root';

      let message = `  - ${path}: ${error.message}`;

      // Add helpful context for common errors
      if (error.code === 'invalid_type' && 'expected' in error && 'received' in error) {
        message += ` (expected ${error.expected}, got ${error.received})`;

        // Detect old transform format (array instead of object)
        if (path.includes('transforms') && error.expected === 'object' && error.received === 'array') {
          message += '\n    BREAKING CHANGE: Transform format changed in v2.0.0';
          message += '\n    OLD: transforms: { "*.yaml": [{ find: "uat", replace: "prod" }] }';
          message += '\n    NEW: transforms: { "*.yaml": { content: [{ find: "uat", replace: "prod" }] } }';
        }
      }

      if (error.code === 'unrecognized_keys' && 'keys' in error) {
        const keys = error.keys as string[];
        message += `\n    Unknown fields: ${keys.join(', ')}`;
        message += '\n    Check for typos or remove unsupported fields';
      }

      return message;
    });

    return header + errors.join('\n');
  };
}

// Type guard to check if an error is a ZodValidationError
export const isZodValidationError = (error: unknown): error is ZodValidationError =>
  error instanceof ZodValidationError;
