// ============================================================================

const YAML_FILE_REGEX = /\.ya?ml$/i;

export const isYamlFile = (filePath: string): boolean => {
  return YAML_FILE_REGEX.test(filePath);
};
