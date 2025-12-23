import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isZodValidationError, ZodValidationError } from '../src/ZodError';

describe('ZodError', () => {
  describe('ZodValidationError - basic formatting', () => {
    it('should format error without source path', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('Validation failed:');
        expect(error.message).not.toContain('in ');
      }
    });

    it('should format error with source path', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error, '/path/to/config.yaml');
        expect(error.message).toContain('Validation failed in /path/to/config.yaml:');
      }
    });

    it('should have correct error name', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.name).toBe('ZodValidationError');
      }
    });

    it('should store zodError property', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.zodError).toBe(result.error);
      }
    });

    it('should store sourcePath property', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error, 'config.yaml');
        expect(error.sourcePath).toBe('config.yaml');
      }
    });
  });

  describe('ZodValidationError - error path formatting', () => {
    it('should show "root" for errors at root level', () => {
      const schema = z.string();
      const result = schema.safeParse(123);

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('root:');
      }
    });

    it('should show dotted path for nested errors', () => {
      const schema = z.object({ user: z.object({ name: z.string() }) });
      const result = schema.safeParse({ user: { name: 123 } });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('user.name:');
      }
    });

    it('should handle array indices in path', () => {
      const schema = z.array(z.object({ id: z.number() }));
      const result = schema.safeParse([{ id: 'not-a-number' }]);

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('0.id:');
      }
    });
  });

  describe('ZodValidationError - invalid_type errors', () => {
    it('should show expected and received types', () => {
      const schema = z.object({ count: z.number() });
      const result = schema.safeParse({ count: 'not-a-number' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('expected number');
        expect(error.message).toContain('received string');
      }
    });

    it('should show helpful message for missing required field', () => {
      const schema = z.object({ required: z.string() });
      const result = schema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('required:');
        expect(error.message).toContain('expected string');
        expect(error.message).toContain('received undefined');
      }
    });
  });

  describe('ZodValidationError - breaking change detection', () => {
    // Note: The breaking change detection in ZodError.ts (lines 28-32) is designed to
    // trigger when the actual configFile schemas fail validation. Testing it directly
    // with mock schemas is difficult because it requires specific Zod error conditions.
    // This is better tested through integration with actual config parsing.

    it('should handle transform validation errors', () => {
      const transformRulesSchema = z.object({
        content: z.array(z.any()).optional(),
        filename: z.array(z.any()).optional()
      });
      const configSchema = z.object({
        transforms: z.record(z.string(), transformRulesSchema)
      });

      const result = configSchema.safeParse({
        transforms: {
          '*.yaml': [{ find: 'uat', replace: 'prod' }] // Old format
        }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('transforms');
        expect(error.message).toContain('expected object');
        expect(error.message).toContain('received array');
      }
    });

    it('should format transforms path errors clearly', () => {
      const transformRulesSchema = z.object({
        content: z.array(z.any()).optional()
      });
      const configSchema = z.object({
        transforms: z.record(z.string(), transformRulesSchema)
      });

      const result = configSchema.safeParse({
        transforms: {
          '*.yaml': [{ find: 'test', replace: 'value' }]
        }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('Validation failed');
        expect(error.message).toContain('transforms');
      }
    });
  });

  describe('ZodValidationError - unrecognized_keys errors', () => {
    it('should list unknown fields', () => {
      const schema = z.object({ name: z.string() }).strict();
      const result = schema.safeParse({ name: 'test', unknown1: 'value', unknown2: 123 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('Unknown fields:');
        expect(error.message).toContain('unknown1');
        expect(error.message).toContain('unknown2');
      }
    });

    it('should suggest checking for typos', () => {
      const schema = z.object({ name: z.string() }).strict();
      const result = schema.safeParse({ name: 'test', typo: 'value' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('Check for typos');
        expect(error.message).toContain('remove unsupported fields');
      }
    });
  });

  describe('ZodValidationError - multiple errors', () => {
    it('should format multiple errors separately', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email()
      });
      const result = schema.safeParse({
        name: 123, // Wrong type
        age: 'not-a-number', // Wrong type
        email: 'invalid-email' // Invalid format
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('name:');
        expect(error.message).toContain('age:');
        expect(error.message).toContain('email:');
      }
    });

    it('should show all errors with proper formatting', () => {
      const schema = z.object({
        field1: z.string(),
        field2: z.number()
      });
      const result = schema.safeParse({
        field1: 123,
        field2: 'string'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        // Each error should be on its own line with "- " prefix
        const lines = error.message.split('\n').filter((line) => line.includes('- '));
        expect(lines.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('ZodValidationError - complex schemas', () => {
    it('should handle nested object validation errors', () => {
      const schema = z.object({
        config: z.object({
          database: z.object({
            host: z.string(),
            port: z.number()
          })
        })
      });
      const result = schema.safeParse({
        config: {
          database: {
            host: 123, // Wrong type
            port: 'not-a-number' // Wrong type
          }
        }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('config.database.host:');
        expect(error.message).toContain('config.database.port:');
      }
    });

    it('should handle array validation errors', () => {
      const schema = z.object({
        items: z.array(z.object({ id: z.number() }))
      });
      const result = schema.safeParse({
        items: [{ id: 1 }, { id: 'invalid' }, { id: 3 }]
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('items.1.id:');
      }
    });

    it('should handle record validation errors', () => {
      const schema = z.record(z.string(), z.number());
      const result = schema.safeParse({
        key1: 123,
        key2: 'not-a-number'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('key2:');
      }
    });
  });

  describe('ZodValidationError - refinement errors', () => {
    it('should show custom error messages from refinements', () => {
      const schema = z
        .object({
          min: z.number(),
          max: z.number()
        })
        .refine((data) => data.min <= data.max, {
          message: 'min must be less than or equal to max',
          path: ['min']
        });

      const result = schema.safeParse({ min: 10, max: 5 });

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(error.message).toContain('min:');
        expect(error.message).toContain('min must be less than or equal to max');
      }
    });
  });

  describe('isZodValidationError type guard', () => {
    it('should return true for ZodValidationError instances', () => {
      const schema = z.string();
      const result = schema.safeParse(123);

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = new ZodValidationError(result.error);
        expect(isZodValidationError(error)).toBe(true);
      }
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isZodValidationError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isZodValidationError('string')).toBe(false);
      expect(isZodValidationError(123)).toBe(false);
      expect(isZodValidationError({})).toBe(false);
      expect(isZodValidationError()).toBe(false);
    });

    it('should work in error handling blocks', () => {
      const schema = z.string();
      const result = schema.safeParse(123);

      try {
        if (!result.success) throw new ZodValidationError(result.error);
      } catch (error: unknown) {
        expect(isZodValidationError(error)).toBe(true);
        if (isZodValidationError(error)) {
          expect(error.zodError).toBeDefined();
          expect(error.message).toBeDefined();
        }
      }
    });
  });
});
