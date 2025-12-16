import { createTwoFilesPatch } from 'diff';

// ============================================================================

export const generateUnifiedDiff = (filePath: string, destinationContent: string, sourceContent: string): string => {
  return createTwoFilesPatch(filePath, filePath, destinationContent, sourceContent, 'Destination', 'Source');
};
