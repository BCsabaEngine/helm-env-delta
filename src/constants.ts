/**
 * Application-wide constants.
 * Centralizes magic numbers and configuration values used across the codebase.
 */

// ============================================================================
// Timing Constants
// ============================================================================

/** Delay in milliseconds before starting sync operation (allows user to cancel) */
export const SYNC_CONFIRMATION_DELAY_MS = 2000;

// ============================================================================
// YAML Formatting Constants
// ============================================================================

/** YAML line width value that disables line wrapping (unlimited width) */
export const YAML_LINE_WIDTH_UNLIMITED = 0;

/** Default indent size for YAML formatting */
export const YAML_DEFAULT_INDENT = 2;

// ============================================================================
// Configuration Constants
// ============================================================================

/** Maximum allowed depth for config inheritance (extends chain) */
export const MAX_CONFIG_EXTENDS_DEPTH = 5;

// ============================================================================
// Validation Patterns
// ============================================================================

/**
 * Strict semver pattern for validating exact major.minor.patch format.
 * Rejects:
 * - Leading zeros (e.g., 01.2.3)
 * - Pre-release versions (e.g., 1.2.3-alpha)
 * - Build metadata (e.g., 1.2.3+build)
 * - Incomplete versions (e.g., 1.2)
 *
 * Pattern breakdown:
 * - (0|[1-9]\d*) = version component: 0 OR (1-9 followed by zero or more digits)
 * - Applied to major, minor, and patch components
 */
export const SEMVER_STRICT_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
