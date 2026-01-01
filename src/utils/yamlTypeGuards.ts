/**
 * Type guards and helpers for YAML AST nodes.
 * Provides safe type checking and value extraction for YAML document manipulation.
 */

import type { Pair, Scalar, YAMLMap, YAMLSeq } from 'yaml';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if a node is a YAML Scalar (leaf value).
 * Scalars have a 'value' property but no 'items' property.
 */
export const isScalar = (node: unknown): node is Scalar => {
  return typeof node === 'object' && node !== null && 'value' in node && !('items' in node);
};

/**
 * Checks if a node is a YAML Map or Sequence (collection).
 * Collections have an 'items' property that is an array.
 */
export const isYamlCollection = (node: unknown): node is YAMLMap | YAMLSeq => {
  return (
    typeof node === 'object' && node !== null && 'items' in node && Array.isArray((node as YAMLMap | YAMLSeq).items)
  );
};

/**
 * Checks if a node is specifically a YAML Map (key-value pairs).
 * Distinguishes from sequences by checking if first item has a 'key' property.
 */
export const isYamlMap = (node: unknown): node is YAMLMap => {
  if (!isYamlCollection(node)) return false;

  const items = (node as YAMLMap | YAMLSeq).items;
  if (items.length === 0) return false;
  const firstItem = items[0];
  return firstItem !== null && typeof firstItem === 'object' && 'key' in firstItem;
};

/**
 * Checks if a node is specifically a YAML Sequence (array).
 * Returns true for collections that are not maps.
 */
export const isYamlSeq = (node: unknown): node is YAMLSeq => {
  if (!isYamlCollection(node)) return false;
  return !isYamlMap(node);
};

// ============================================================================
// Value Extraction Helpers
// ============================================================================

/**
 * Extracts the string value from a Pair's key.
 * Returns undefined if the key is not a scalar with a value.
 *
 * @param item - The Pair to extract the key from
 * @returns The key as a string, or undefined if not extractable
 */
export const extractKeyValue = (item: Pair): string | undefined => {
  if (item.key && typeof item.key === 'object' && 'value' in item.key) return String(item.key.value);

  return undefined;
};

/**
 * Safely extracts the value from a Scalar node.
 * Returns undefined if the node is not a scalar.
 */
export const extractScalarValue = (node: unknown): unknown => {
  if (isScalar(node)) return node.value;

  return undefined;
};
