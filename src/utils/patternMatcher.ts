import { makeRe } from 'picomatch';

// ============================================================================
// Glob Pattern Matcher with Caching
// ============================================================================

/**
 * Caches compiled glob patterns for fast matching.
 * Uses picomatch's makeRe for pre-compilation to avoid repeated pattern parsing.
 */
export class PatternMatcher {
  private cache = new Map<string, RegExp>();

  /**
   * Compiles a glob pattern to a RegExp, caching the result.
   * Subsequent calls with the same pattern return the cached RegExp.
   */
  compilePattern(pattern: string): RegExp {
    let compiled = this.cache.get(pattern);
    if (!compiled) {
      compiled = makeRe(pattern);
      this.cache.set(pattern, compiled);
    }
    return compiled;
  }

  /**
   * Tests if a path matches a glob pattern.
   * Patterns are compiled and cached on first use.
   */
  match(path: string, pattern: string): boolean {
    const regex = this.compilePattern(pattern);
    return regex.test(path);
  }

  /**
   * Clears the pattern cache.
   * Useful for testing or when patterns need to be recompiled.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Global singleton instance for shared pattern cache
export const globalMatcher = new PatternMatcher();
