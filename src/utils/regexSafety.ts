/**
 * Utility for detecting potentially unsafe regex patterns that could cause
 * catastrophic backtracking (ReDoS vulnerabilities).
 */

/**
 * Checks if a regex pattern is safe from catastrophic backtracking (ReDoS).
 * Detects the most common dangerous pattern: nested quantifiers on groups,
 * e.g. (a+)+, (a*)*, (a+)*, ([a-z]+)+ etc.
 *
 * @param pattern - The regex pattern string to check
 * @returns true if the pattern appears safe, false if it may cause ReDoS
 */
export const isSafeRegex = (pattern: string): boolean => {
  // Detect nested quantifiers on groups (primary ReDoS trigger):
  // Matches any group (...) that contains + or * followed by +, *, or {
  if (/\([^()]*[*+][^()]*\)[*+{]/.test(pattern)) return false;

  return true;
};
