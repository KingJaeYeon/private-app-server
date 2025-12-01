import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const YAML_CONFIG_FILENAME = `${process.env.NODE_ENV}.yaml`;

export default () => {
  const file = readFileSync(join(__dirname, YAML_CONFIG_FILENAME), 'utf8');
  return yaml.load(file) as Record<string, any>;
};
