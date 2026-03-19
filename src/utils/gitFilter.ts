import path from 'node:path';

import simpleGit, { type SimpleGit } from 'simple-git';

import type { FileMap } from '../pipeline';
import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Error Handling
// ============================================================================

const GitFilterError = createErrorClass('GitFilterError', {
  NOT_GIT_REPO: 'Current directory is not a git repository.',
  NO_GIT_USER: 'No git user configured. Run: git config user.name "Your Name"',
  GIT_COMMAND_FAILED: 'Git command failed'
});

export const isGitFilterError = createErrorTypeGuard(GitFilterError);

// ============================================================================
// Internal Helpers
// ============================================================================

const getGitRoot = async (git: SimpleGit): Promise<string> => {
  const result = await git.revparse(['--show-toplevel']);
  return result.trim();
};

export const getGitUser = async (git?: SimpleGit): Promise<string> => {
  const g = git ?? simpleGit();

  try {
    const nameResult = await g.raw(['config', 'user.name']);
    const name = nameResult.trim();
    if (name) return name;

    const emailResult = await g.raw(['config', 'user.email']);
    const email = emailResult.trim();
    if (email) return email;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not a git repository'))
      throw new GitFilterError('Current directory is not a git repository.', { code: 'NOT_GIT_REPO' });

    throw new GitFilterError('Git command failed', { code: 'GIT_COMMAND_FAILED', cause: error as Error });
  }

  throw new GitFilterError('No git user configured. Run: git config user.name "Your Name"', { code: 'NO_GIT_USER' });
};

const getGitModifiedPaths = async (
  git: SimpleGit,
  author: string,
  days: number,
  absoluteSourceDirectory: string
): Promise<Set<string>> => {
  try {
    const output = await git.raw([
      'log',
      `--author=${author}`,
      `--since=${days} days ago`,
      '--name-only',
      '--pretty=format:',
      '--',
      absoluteSourceDirectory
    ]);

    const paths = new Set<string>();

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) paths.add(trimmed);
    }

    return paths;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not a git repository'))
      throw new GitFilterError('Current directory is not a git repository.', { code: 'NOT_GIT_REPO' });

    throw new GitFilterError('Git command failed', { code: 'GIT_COMMAND_FAILED', cause: error as Error });
  }
};

// ============================================================================
// Exported Filter Function
// ============================================================================

export const filterFileMapsByGitAuthor = async (
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  absoluteSourceDirectory: string,
  author: string,
  days: number
): Promise<{ sourceFiles: FileMap; destinationFiles: FileMap }> => {
  const git = simpleGit(absoluteSourceDirectory);
  const gitRoot = await getGitRoot(git);
  const gitModifiedPaths = await getGitModifiedPaths(git, author, days, absoluteSourceDirectory);

  const matchingKeys = new Set<string>();

  for (const gitRelativePath of gitModifiedPaths) {
    const absolutePath = path.join(gitRoot, gitRelativePath);
    const fileMapKey = path.relative(absoluteSourceDirectory, absolutePath).replaceAll(path.sep, '/');
    matchingKeys.add(fileMapKey);
  }

  const filteredSource = new Map<string, string>();
  const filteredDestination = new Map<string, string>();

  for (const [filePath, content] of sourceFiles) if (matchingKeys.has(filePath)) filteredSource.set(filePath, content);

  for (const [filePath, content] of destinationFiles)
    if (matchingKeys.has(filePath)) filteredDestination.set(filePath, content);

  return { sourceFiles: filteredSource, destinationFiles: filteredDestination };
};
