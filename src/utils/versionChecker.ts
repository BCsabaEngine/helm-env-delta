import https from 'node:https';

import chalk from 'chalk';

import packageJson from '../../package.json';
import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Error Class
// ============================================================================

const VersionCheckerErrorClass = createErrorClass('Version Checker Error', {
  TIMEOUT: 'Request timed out',
  NETWORK: 'Network request failed',
  PARSE: 'Failed to parse response',
  INVALID: 'Invalid response format'
});

export class VersionCheckerError extends VersionCheckerErrorClass {}
export const isVersionCheckerError = createErrorTypeGuard(VersionCheckerError);

// ============================================================================
// Types
// ============================================================================

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

interface NpmRegistryResponse {
  version: string;
}

// ============================================================================
// CI Detection
// ============================================================================

const isCiEnvironment = (): boolean => {
  const ciEnvironmentVariables = [
    'CI',
    'CONTINUOUS_INTEGRATION',
    'BUILD_NUMBER',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'CIRCLECI',
    'TRAVIS',
    'JENKINS_HOME',
    'TEAMCITY_VERSION',
    'TF_BUILD'
  ];

  return ciEnvironmentVariables.some((environmentVariable) => process.env[environmentVariable]);
};

// ============================================================================
// Version Comparison
// ============================================================================

export const parseVersion = (version: string): SemverParts | undefined => {
  const semverRegex = /^v?(\d+)\.(\d+)\.(\d+)/;
  const match = semverRegex.exec(version);

  if (!match) return undefined;

  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10)
  };
};

export const isNewerVersion = (current: string, latest: string): boolean => {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);

  if (!currentParts || !latestParts) return false;

  if (latestParts.major > currentParts.major) return true;
  if (latestParts.major < currentParts.major) return false;

  if (latestParts.minor > currentParts.minor) return true;
  if (latestParts.minor < currentParts.minor) return false;

  return latestParts.patch > currentParts.patch;
};

// ============================================================================
// NPM Registry Fetch
// ============================================================================

const fetchLatestVersion = (packageName: string, timeout: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`;

    const request = https.request(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': `helm-env-delta/${packageJson.version}`
        },
        signal: AbortSignal.timeout(timeout)
      },
      (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new VersionCheckerError(`HTTP ${response.statusCode}`, { code: 'NETWORK' }));
            return;
          }

          try {
            const json = JSON.parse(data) as NpmRegistryResponse;
            if (!json.version) {
              reject(new VersionCheckerError('Missing version field', { code: 'INVALID' }));
              return;
            }
            resolve(json.version);
          } catch {
            reject(new VersionCheckerError('Invalid JSON response', { code: 'PARSE' }));
          }
        });
      }
    );

    request.on('error', (error: Error) => {
      const isTimeout = error.name === 'AbortError';
      const code = isTimeout ? 'TIMEOUT' : 'NETWORK';
      reject(new VersionCheckerError(error.message, { code, cause: error }));
    });

    request.end();
  });
};

// ============================================================================
// Display
// ============================================================================

const displayUpdateNotification = (currentVersion: string, latestVersion: string): void => {
  console.log('\n' + chalk.yellow(`⚠ Update available! v${currentVersion} → v${latestVersion}`));
  console.log(chalk.yellow('Run: npm install -g helm-env-delta@latest'));
};

// ============================================================================
// Main API
// ============================================================================

export const checkForUpdates = async (currentVersion: string): Promise<void> => {
  // Skip in CI environments
  if (isCiEnvironment()) return;

  try {
    const latestVersion = await fetchLatestVersion('helm-env-delta', 3000);

    if (isNewerVersion(currentVersion, latestVersion)) displayUpdateNotification(currentVersion, latestVersion);
  } catch {
    // Silent fail
  }
};
