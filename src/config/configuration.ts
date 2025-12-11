import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

export default () => {
  const env = process.env.NODE_ENV || 'development';
  const YAML_CONFIG_FILENAME = `${env}.yaml`;

  const file = readFileSync(join(__dirname, YAML_CONFIG_FILENAME), 'utf8');
  const config = yaml.load(file) as Record<string, any>;
  return {
    nodeEnv: env,
    ...config
  };
};
