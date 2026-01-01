import { createTwoFilesPatch } from 'diff';

// ============================================================================

export const generateUnifiedDiff = (filePath: string, destinationContent: string, sourceContent: string): string =>
  createTwoFilesPatch(filePath, filePath, destinationContent, sourceContent, 'Destination', 'Source');
