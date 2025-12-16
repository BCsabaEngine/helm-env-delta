// ============================================================================
// Base Error Factory
// ============================================================================

export interface ErrorOptions {
  code?: string;
  path?: string;
  cause?: Error;
  [key: string]: unknown;
}

type ErrorFormatter = (message: string, options: ErrorOptions) => string;

// Creates a custom error class with consistent formatting
export const createErrorClass = (
  errorName: string,
  codeExplanations: Record<string, string> = {},
  customFormatter?: ErrorFormatter
) => {
  const formatMessage = (message: string, options: ErrorOptions): string => {
    if (customFormatter) return customFormatter(message, options);

    let fullMessage = `${errorName}: ${message}`;

    if (options.path) fullMessage += `\n  Path: ${options.path}`;

    if (options.code) {
      const explanation = codeExplanations[options.code] || `Error (${options.code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (options.cause) fullMessage += `\n  Details: ${options.cause.message}`;

    return fullMessage;
  };

  class CustomError extends Error {
    public readonly code?: string;
    public readonly path?: string;
    public override readonly cause?: Error;
    [key: string]: unknown;

    constructor(message: string, options: ErrorOptions = {}) {
      super(formatMessage(message, options));
      this.name = 'CustomError';
      Object.defineProperty(this, 'name', { value: errorName, enumerable: false });
      this.code = options.code;
      this.path = options.path;
      this.cause = options.cause;

      for (const [key, value] of Object.entries(options))
        if (key !== 'code' && key !== 'path' && key !== 'cause') this[key] = value;
    }
  }

  return CustomError;
};

// Type guard factory
export const createErrorTypeGuard =
  <T extends Error>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ErrorClass: new (...arguments_: any[]) => T
  ) =>
  (error: unknown): error is T =>
    error instanceof ErrorClass;
