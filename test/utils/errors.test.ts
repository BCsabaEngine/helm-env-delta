import { describe, expect, it } from 'vitest';

import { createErrorClass, createErrorTypeGuard, ErrorOptions } from '../../src/utils/errors';

const customErrorFormatter = (message: string, options: ErrorOptions): string => {
  return `CUSTOM: ${message} [code=${options.code || 'none'}]`;
};

describe('utils/errors', () => {
  describe('createErrorClass', () => {
    it('should create error with message only', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Something went wrong');

      expect(error.message).toBe('Test Error: Something went wrong');
      expect(error.name).toBe('Test Error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create error with code and code explanation', () => {
      const TestError = createErrorClass('Test Error', {
        ENOENT: 'File not found',
        EACCES: 'Permission denied'
      });

      const error = new TestError('Could not read file', { code: 'ENOENT' });

      expect(error.message).toContain('Test Error: Could not read file');
      expect(error.message).toContain('Reason: File not found');
      expect(error.code).toBe('ENOENT');
    });

    it('should create error with path information', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Operation failed', { path: '/tmp/test.yaml' });

      expect(error.message).toContain('Test Error: Operation failed');
      expect(error.message).toContain('Path: /tmp/test.yaml');
      expect(error.path).toBe('/tmp/test.yaml');
    });

    it('should create error with cause', () => {
      const TestError = createErrorClass('Test Error');
      const cause = new Error('Original error');
      const error = new TestError('Wrapped error', { cause });

      expect(error.message).toContain('Test Error: Wrapped error');
      expect(error.message).toContain('Details: Original error');
      expect(error.cause).toBe(cause);
    });

    it('should create error with custom options', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Test', { customKey: 'customValue', anotherKey: 123 });

      expect(error.customKey).toBe('customValue');
      expect(error.anotherKey).toBe(123);
    });

    it('should set error name property correctly', () => {
      const TestError = createErrorClass('Custom Error Name');
      const error = new TestError('Test message');

      expect(error.name).toBe('Custom Error Name');
      const descriptor = Object.getOwnPropertyDescriptor(error, 'name');
      expect(descriptor?.enumerable).toBe(false);
    });

    it('should format error message with all options combined', () => {
      const TestError = createErrorClass('Test Error', {
        ENOENT: 'File not found'
      });

      const cause = new Error('Underlying issue');
      const error = new TestError('Operation failed', {
        code: 'ENOENT',
        path: '/tmp/file.txt',
        cause
      });

      expect(error.message).toContain('Test Error: Operation failed');
      expect(error.message).toContain('Path: /tmp/file.txt');
      expect(error.message).toContain('Reason: File not found');
      expect(error.message).toContain('Details: Underlying issue');
    });

    it('should use custom formatter when provided', () => {
      const TestError = createErrorClass('Test Error', {}, customErrorFormatter);
      const error = new TestError('Test message', { code: 'TEST' });

      expect(error.message).toBe('CUSTOM: Test message [code=TEST]');
    });

    it('should handle multiple code explanations', () => {
      const TestError = createErrorClass('Test Error', {
        ENOENT: 'File not found',
        EACCES: 'Permission denied',
        EISDIR: 'Is a directory',
        EEXIST: 'Already exists'
      });

      const error1 = new TestError('Test', { code: 'ENOENT' });
      expect(error1.message).toContain('Reason: File not found');

      const error2 = new TestError('Test', { code: 'EACCES' });
      expect(error2.message).toContain('Reason: Permission denied');

      const error3 = new TestError('Test', { code: 'EISDIR' });
      expect(error3.message).toContain('Reason: Is a directory');
    });

    it('should return generic message for undefined code', () => {
      const TestError = createErrorClass('Test Error', {
        KNOWN: 'Known error'
      });

      const error = new TestError('Test', { code: 'UNKNOWN' });

      expect(error.message).toContain('Reason: Error (UNKNOWN)');
    });

    it('should handle null code gracefully', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Test', { code: undefined });

      expect(error.message).toBe('Test Error: Test');
      expect(error.code).toBeUndefined();
    });

    it('should spread custom options correctly', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Test', {
        customProp1: 'value1',
        customProp2: 42,
        customProp3: true,
        customProp4: { nested: 'object' }
      });

      expect(error.customProp1).toBe('value1');
      expect(error.customProp2).toBe(42);
      expect(error.customProp3).toBe(true);
      expect(error.customProp4).toEqual({ nested: 'object' });
    });

    it('should maintain inheritance chain', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TestError);
    });

    it('should preserve stack trace', () => {
      const TestError = createErrorClass('Test Error');
      const error = new TestError('Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test Error');
    });

    it('should create multiple instances independently', () => {
      const TestError = createErrorClass('Test Error');
      const error1 = new TestError('First error', { path: '/path1' });
      const error2 = new TestError('Second error', { path: '/path2' });

      expect(error1.path).toBe('/path1');
      expect(error2.path).toBe('/path2');
      expect(error1.message).toContain('First error');
      expect(error2.message).toContain('Second error');
    });
  });

  describe('createErrorTypeGuard', () => {
    it('should return true for correct error instance', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);
      const error = new TestError('Test');

      expect(isTestError(error)).toBe(true);
    });

    it('should return false for different error instance', () => {
      const TestError1 = createErrorClass('Test Error 1');
      const TestError2 = createErrorClass('Test Error 2');
      const isTestError1 = createErrorTypeGuard(TestError1);

      const error = new TestError2('Test');

      expect(isTestError1(error)).toBe(false);
    });

    it('should return false for regular Error', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);

      const error = new Error('Regular error');

      expect(isTestError(error)).toBe(false);
    });

    it('should return false for undefined', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);

      expect(isTestError()).toBe(false);
    });

    it('should return false for undefined', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);

      expect(isTestError()).toBe(false);
    });

    it('should return false for non-error objects', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);

      expect(isTestError({ message: 'fake error' })).toBe(false);
      expect(isTestError({ name: 'Test Error' })).toBe(false);
    });

    it('should return false for primitives', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);

      expect(isTestError('string')).toBe(false);
      expect(isTestError(123)).toBe(false);
      expect(isTestError(true)).toBe(false);
    });

    it('should work with inherited error classes', () => {
      const BaseError = createErrorClass('Base Error');

      class CustomExtendedError extends BaseError {
        constructor(message: string, options: ErrorOptions = {}) {
          super(message, options);
          this.name = 'CustomExtendedError';
        }
      }

      const isBaseError = createErrorTypeGuard(BaseError);
      const error = new CustomExtendedError('Test');

      expect(isBaseError(error)).toBe(true);
    });

    it('should enable type narrowing', () => {
      const TestError = createErrorClass('Test Error');
      const isTestError = createErrorTypeGuard(TestError);

      const error: unknown = new TestError('Test', { code: 'TEST' });

      if (isTestError(error)) {
        expect(error.code).toBe('TEST');
        expect(error.message).toContain('Test');
      } else expect.fail('Type guard should have returned true');
    });

    it('should not interfere with multiple type guards', () => {
      const Error1 = createErrorClass('Error 1');
      const Error2 = createErrorClass('Error 2');
      const isError1 = createErrorTypeGuard(Error1);
      const isError2 = createErrorTypeGuard(Error2);

      const error1 = new Error1('Test 1');
      const error2 = new Error2('Test 2');

      expect(isError1(error1)).toBe(true);
      expect(isError1(error2)).toBe(false);
      expect(isError2(error1)).toBe(false);
      expect(isError2(error2)).toBe(true);
    });
  });
});
