/**
 * Version string validation utilities.
 * Validates semver format with configurable v-prefix requirements.
 */

import { SEMVER_STRICT_PATTERN } from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface VersionValidationResult {
  isValid: boolean;
  message: string;
}

export type VPrefixMode = 'required' | 'allowed' | 'forbidden';

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Checks if version string satisfies v-prefix requirements.
 */
const checkVPrefix = (version: string, vPrefixMode?: VPrefixMode): VersionValidationResult | undefined => {
  if (!vPrefixMode) return undefined;

  const hasVPrefix = version.startsWith('v');

  if (vPrefixMode === 'required' && !hasVPrefix)
    return {
      isValid: false,
      message: `Version "${version}" must start with "v" prefix (e.g., "v1.2.3")`
    };

  if (vPrefixMode === 'forbidden' && hasVPrefix)
    return {
      isValid: false,
      message: `Version "${version}" must not have "v" prefix (use "1.2.3" instead of "v1.2.3")`
    };

  return undefined;
};

/**
 * Checks if version has the exact major.minor.patch format.
 */
const checkVersionFormat = (version: string, versionWithoutPrefix: string): VersionValidationResult | undefined => {
  const match = SEMVER_STRICT_PATTERN.exec(versionWithoutPrefix);

  if (match) return undefined; // Valid format

  // Determine specific error message
  const parts = versionWithoutPrefix.split('.');
  const partsCount = parts.length;

  if (partsCount < 3)
    return {
      isValid: false,
      message: `Version "${version}" is incomplete. Expected format: major.minor.patch (e.g., "1.2.3"), got only ${partsCount} part(s)`
    };

  if (partsCount > 3)
    return {
      isValid: false,
      message: `Version "${version}" has too many parts. Expected format: major.minor.patch (e.g., "1.2.3"), got ${partsCount} parts`
    };

  return undefined; // Continue to other checks
};

/**
 * Checks for leading zeros in version parts.
 */
const checkLeadingZeros = (version: string, versionWithoutPrefix: string): VersionValidationResult | undefined => {
  const parts = versionWithoutPrefix.split('.');
  const hasLeadingZeros = parts.some((part) => part.length > 1 && part.startsWith('0'));

  if (hasLeadingZeros)
    return {
      isValid: false,
      message: `Version "${version}" has leading zeros. Use canonical format (e.g., "1.2.3" instead of "1.02.3")`
    };

  return undefined;
};

/**
 * Checks for pre-release identifiers or build metadata.
 */
const checkPreReleaseAndBuildMetadata = (
  version: string,
  versionWithoutPrefix: string
): VersionValidationResult | undefined => {
  const hasPreReleaseSuffix = /\d+\.\d+\.\d+[+-]/.test(versionWithoutPrefix);

  if (hasPreReleaseSuffix)
    return {
      isValid: false,
      message: `Version "${version}" contains pre-release identifier or build metadata. Only major.minor.patch format is allowed (e.g., "1.2.3")`
    };

  return undefined;
};

/**
 * Checks for non-numeric parts in version string.
 */
const checkNonNumericParts = (version: string, versionWithoutPrefix: string): VersionValidationResult | undefined => {
  const parts = versionWithoutPrefix.split('.');
  const hasNonNumeric = parts.some((part) => !/^\d+$/.test(part));

  if (hasNonNumeric)
    return {
      isValid: false,
      message: `Version "${version}" has non-numeric parts. Expected format: major.minor.patch (e.g., "1.2.3")`
    };

  return undefined;
};

/**
 * Validates a version string against strict semver format with v-prefix requirements.
 *
 * @param version - The version string to validate
 * @param vPrefixMode - Whether v-prefix is required, allowed, or forbidden
 * @returns Validation result with isValid flag and error message
 *
 * @example
 * validateVersionString('1.2.3', 'forbidden') // { isValid: true, message: '' }
 * validateVersionString('v1.2.3', 'required') // { isValid: true, message: '' }
 * validateVersionString('1.2', 'allowed')     // { isValid: false, message: '...' }
 */
export const validateVersionString = (version: string, vPrefixMode?: VPrefixMode): VersionValidationResult => {
  const hasVPrefix = version.startsWith('v');
  const versionWithoutPrefix = hasVPrefix ? version.slice(1) : version;

  // Run validation checks in order (early return on first error)
  const checks = [
    () => checkVPrefix(version, vPrefixMode),
    () => checkVersionFormat(version, versionWithoutPrefix),
    () => checkLeadingZeros(version, versionWithoutPrefix),
    () => checkPreReleaseAndBuildMetadata(version, versionWithoutPrefix),
    () => checkNonNumericParts(version, versionWithoutPrefix)
  ];

  for (const check of checks) {
    const result = check();
    if (result) return result;
  }

  // All checks passed
  return {
    isValid: true,
    message: ''
  };
};
