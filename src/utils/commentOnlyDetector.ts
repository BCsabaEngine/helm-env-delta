/**
 * Checks if content contains only comments and empty/whitespace lines.
 * A comment line starts with # (optionally preceded by whitespace).
 * An empty line is one that contains only whitespace or is completely empty.
 */
export const isCommentOnlyContent = (content: string): boolean => {
  if (!content) return false;

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines
    if (trimmed === '') continue;
    // Skip comment lines
    if (trimmed.startsWith('#')) continue;
    // Found non-comment, non-empty line
    return false;
  }

  return true;
};
