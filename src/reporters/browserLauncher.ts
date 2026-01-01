import path from 'node:path';

import { createErrorClass, createErrorTypeGuard } from '../utils/errors';

// ============================================================================
// Error Handling
// ============================================================================

const BrowserLauncherErrorClass = createErrorClass('Browser Launcher Error');

export class BrowserLauncherError extends BrowserLauncherErrorClass {}

export const isBrowserLauncherError = createErrorTypeGuard(BrowserLauncherError);

// ============================================================================
// Browser Launcher
// ============================================================================

/**
 * Opens a file in the system's default browser.
 *
 * Uses the `open` package to launch the file in the default browser.
 * Provides cross-platform support for macOS, Linux, and Windows.
 *
 * @param filePath - Path to the HTML file to open
 * @throws {BrowserLauncherError} If opening the browser fails
 *
 * @example
 * ```typescript
 * try {
 *   await openInBrowser('/tmp/report.html');
 * } catch (error) {
 *   console.error('Failed to open browser:', error.message);
 * }
 * ```
 */
export const openInBrowser = async (filePath: string): Promise<void> => {
  try {
    const openModule = await import('open');
    const open = openModule.default;
    const absolutePath = path.resolve(filePath);
    await open(absolutePath);
  } catch (error) {
    const absolutePath = path.resolve(filePath);

    throw new BrowserLauncherError('Failed to open report in browser', {
      code: 'BROWSER_OPEN_FAILED',
      path: filePath,
      cause: error as Error,
      hints: [`File location: ${absolutePath}`, `macOS: open ${absolutePath}`, `Linux: xdg-open ${absolutePath}`]
    });
  }
};
