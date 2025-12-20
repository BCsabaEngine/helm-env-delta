import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock https module before importing versionChecker
vi.mock('node:https', () => ({
  default: {
    request: vi.fn()
  }
}));

import https from 'node:https';

import { checkForUpdates, isVersionCheckerError, VersionCheckerError } from '../../src/utils/versionChecker';

describe('utils/versionChecker', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Clear all CI environment variables
    delete process.env.CI;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.BUILD_NUMBER;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.CIRCLECI;
    delete process.env.TRAVIS;
    delete process.env.JENKINS_HOME;
    delete process.env.TEAMCITY_VERSION;
    delete process.env.TF_BUILD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('VersionCheckerError', () => {
    it('should create error with code', () => {
      const error = new VersionCheckerError('Test error', { code: 'TIMEOUT' });

      expect(error.message).toContain('Version Checker Error: Test error');
      expect(error.message).toContain('Reason: Request timed out');
      expect(error.code).toBe('TIMEOUT');
    });

    it('should be identifiable with type guard', () => {
      const error = new VersionCheckerError('Test error');

      expect(isVersionCheckerError(error)).toBe(true);
      expect(isVersionCheckerError(new Error('Other error'))).toBe(false);
    });
  });

  describe('CI environment detection', () => {
    it('should skip check when CI env var is set', async () => {
      process.env.CI = 'true';

      await checkForUpdates('1.0.0');

      expect(https.request).not.toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should skip check when CONTINUOUS_INTEGRATION is set', async () => {
      process.env.CONTINUOUS_INTEGRATION = 'true';

      await checkForUpdates('1.0.0');

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should skip check when BUILD_NUMBER is set', async () => {
      process.env.BUILD_NUMBER = '123';

      await checkForUpdates('1.0.0');

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should skip check when GITHUB_ACTIONS is set', async () => {
      process.env.GITHUB_ACTIONS = 'true';

      await checkForUpdates('1.0.0');

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should skip check when GITLAB_CI is set', async () => {
      process.env.GITLAB_CI = 'true';

      await checkForUpdates('1.0.0');

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should skip check when any CI env var is set', async () => {
      const ciVariables = ['CIRCLECI', 'TRAVIS', 'JENKINS_HOME', 'TEAMCITY_VERSION', 'TF_BUILD'];

      for (const environmentVariable of ciVariables) {
        vi.clearAllMocks();
        process.env[environmentVariable] = 'true';

        await checkForUpdates('1.0.0');

        expect(https.request).not.toHaveBeenCalled();
        delete process.env[environmentVariable];
      }
    });

    it('should check when no CI env vars are set', async () => {
      mockHttpsSuccess('2.0.0');

      await checkForUpdates('1.0.0');

      expect(https.request).toHaveBeenCalled();
    });
  });

  describe('version comparison', () => {
    it('should detect newer major version', async () => {
      mockHttpsSuccess('2.0.0');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Update available'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('v1.0.0 → v2.0.0'));
    });

    it('should detect newer minor version', async () => {
      mockHttpsSuccess('1.5.0');

      await checkForUpdates('1.4.0');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Update available'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('v1.4.0 → v1.5.0'));
    });

    it('should detect newer patch version', async () => {
      mockHttpsSuccess('1.0.5');

      await checkForUpdates('1.0.4');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Update available'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('v1.0.4 → v1.0.5'));
    });

    it('should not display notification for equal versions', async () => {
      mockHttpsSuccess('1.2.3');

      await checkForUpdates('1.2.3');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should not display notification when current is newer', async () => {
      mockHttpsSuccess('1.0.0');

      await checkForUpdates('2.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle version with v prefix in response', async () => {
      mockHttpsSuccess('v2.0.0');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Update available'));
    });

    it('should handle version with pre-release suffix', async () => {
      mockHttpsSuccess('2.0.0-beta.1');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Update available'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('v1.0.0 → v2.0.0-beta.1'));
    });
  });

  describe('HTTP request handling', () => {
    it('should fetch latest version successfully', async () => {
      mockHttpsSuccess('2.0.0');

      await checkForUpdates('1.0.0');

      expect(https.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/helm-env-delta/latest',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
            'User-Agent': expect.stringContaining('helm-env-delta/')
          })
        }),
        expect.any(Function)
      );
    });

    it('should handle timeout silently', async () => {
      mockHttpsTimeout();

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle network error silently', async () => {
      mockHttpsError(new Error('Network error'));

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle HTTP 429 rate limit silently', async () => {
      mockHttpsStatus(429, '{"error": "Too many requests"}');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle HTTP 404 silently', async () => {
      mockHttpsStatus(404, '{"error": "Not found"}');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle HTTP 500 silently', async () => {
      mockHttpsStatus(500, '{"error": "Server error"}');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON silently', async () => {
      mockHttpsStatus(200, 'not valid json{');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle missing version field silently', async () => {
      mockHttpsStatus(200, '{"name": "helm-env-delta"}');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle empty response silently', async () => {
      mockHttpsStatus(200, '');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('display notification', () => {
    it('should display update notification with correct format', async () => {
      mockHttpsSuccess('2.5.3');

      await checkForUpdates('1.2.0');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('⚠'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Update available'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('v1.2.0 → v2.5.3'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('npm install -g helm-env-delta@latest'));
    });

    it('should include blank line before notification', async () => {
      mockHttpsSuccess('2.0.0');

      await checkForUpdates('1.0.0');

      const calls = mockConsoleLog.mock.calls;
      expect(calls.some((call) => call[0].startsWith('\n'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid current version silently', async () => {
      mockHttpsSuccess('2.0.0');

      await checkForUpdates('invalid');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle invalid latest version silently', async () => {
      mockHttpsSuccess('not-a-version');

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle DNS error silently', async () => {
      mockHttpsError(new Error('getaddrinfo ENOTFOUND'));

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle connection refused silently', async () => {
      mockHttpsError(new Error('connect ECONNREFUSED'));

      await checkForUpdates('1.0.0');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

const mockHttpsSuccess = (version: string) => {
  vi.mocked(https.request).mockImplementation((url, options, callback) => {
    // eslint-disable-next-line unicorn/prefer-event-target -- Mocking Node.js https which uses EventEmitter
    const request = new EventEmitter();
    // eslint-disable-next-line unicorn/prefer-event-target -- Mocking Node.js https which uses EventEmitter
    const response = new EventEmitter();

    // @ts-expect-error - Mock statusCode
    response.statusCode = 200;

    // @ts-expect-error - Add end method
    request.end = () => {
      // Call callback synchronously when end is called
      callback(response);

      // Emit events asynchronously
      process.nextTick(() => {
        response.emit('data', Buffer.from(JSON.stringify({ version })));
        response.emit('end');
      });
    };

    return request;
  });
};

const mockHttpsStatus = (statusCode: number, data: string) => {
  vi.mocked(https.request).mockImplementation((url, options, callback) => {
    // eslint-disable-next-line unicorn/prefer-event-target -- Mocking Node.js https which uses EventEmitter
    const request = new EventEmitter();
    // eslint-disable-next-line unicorn/prefer-event-target -- Mocking Node.js https which uses EventEmitter
    const response = new EventEmitter();

    // @ts-expect-error - Mock statusCode
    response.statusCode = statusCode;

    // @ts-expect-error - Add end method
    request.end = () => {
      // Call callback synchronously when end is called
      callback(response);

      // Emit events asynchronously
      process.nextTick(() => {
        response.emit('data', Buffer.from(data));
        response.emit('end');
      });
    };

    return request;
  });
};

const mockHttpsError = (error: Error) => {
  vi.mocked(https.request).mockImplementation(() => {
    // eslint-disable-next-line unicorn/prefer-event-target -- Mocking Node.js https which uses EventEmitter
    const request = new EventEmitter();

    // @ts-expect-error - Add end method
    request.end = () => {
      process.nextTick(() => {
        request.emit('error', error);
      });
    };

    return request;
  });
};

const mockHttpsTimeout = () => {
  vi.mocked(https.request).mockImplementation(() => {
    // eslint-disable-next-line unicorn/prefer-event-target -- Mocking Node.js https which uses EventEmitter
    const request = new EventEmitter();

    // @ts-expect-error - Add end method
    request.end = () => {
      process.nextTick(() => {
        const timeoutError = new Error('The operation was aborted');
        timeoutError.name = 'AbortError';
        request.emit('error', timeoutError);
      });
    };

    return request;
  });
};
