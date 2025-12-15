import YAML from 'yaml';

// ============================================================================
// Types
// ============================================================================

export interface ArrayDiffResult {
  added: unknown[];
  removed: unknown[];
  unchanged: unknown[];
}

// ============================================================================
// Array Diffing Functions
// ============================================================================

const serialize = (item: unknown) => YAML.stringify(item, { sortMapEntries: true });

export const diffArrays = (sourceArray: unknown[], destinationArray: unknown[]): ArrayDiffResult => {
  const sourceSet = new Map<string, unknown>();
  const destinationSet = new Map<string, unknown>();

  for (const item of sourceArray) sourceSet.set(serialize(item), item);

  for (const item of destinationArray) destinationSet.set(serialize(item), item);

  const added: unknown[] = [];
  const removed: unknown[] = [];
  const unchanged: unknown[] = [];

  for (const [key, item] of sourceSet)
    if (destinationSet.has(key)) unchanged.push(item);
    else added.push(item);

  for (const [key, item] of destinationSet) if (!sourceSet.has(key)) removed.push(item);

  return { added, removed, unchanged };
};

export const hasArrays = (value: unknown): boolean => {
  if (Array.isArray(value)) return true;

  if (typeof value === 'object' && value !== null) return Object.values(value).some((value_) => hasArrays(value_));

  return false;
};

export const findArrayPaths = (object: unknown, currentPath: string[] = []): string[][] => {
  const paths: string[][] = [];

  if (Array.isArray(object)) paths.push([...currentPath]);

  if (typeof object === 'object' && object !== null && !Array.isArray(object))
    for (const [key, value] of Object.entries(object)) paths.push(...findArrayPaths(value, [...currentPath, key]));

  return paths;
};
