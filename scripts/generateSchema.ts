import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { baseConfigSchema } from '../src/config/configFile.js';

const raw = z.toJSONSchema(baseConfigSchema, { target: 'draft-7' });

delete (raw as Record<string, unknown>)['$schema'];

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'helm-env-delta Configuration',
  description:
    'JSON Schema for helm-env-delta (hed) config files. ' +
    'Reference via yaml-language-server modeline or VS Code yaml.schemas setting.',
  ...raw
};

const outputPath = path.resolve('config.schema.json');
writeFileSync(outputPath, JSON.stringify(schema, undefined, 2) + '\n', 'utf8');
console.log(`Generated ${outputPath}`);
