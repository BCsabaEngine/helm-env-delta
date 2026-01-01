// ============================================================================

const YAML_FILE_REGEX = /\.ya?ml$/i;

export const isYamlFile = (filePath: string): boolean => YAML_FILE_REGEX.test(filePath);
