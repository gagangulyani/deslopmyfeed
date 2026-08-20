import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

export const LABELS = ['human', 'ai', 'assisted', 'adversarial'];

/** @param {string} label @returns {{id: string, label: string, text: string}[]} */
export function loadCorpus(label) {
  return JSON.parse(readFileSync(join(FIXTURES, `${label}.json`), 'utf8'));
}

/** Every fixture across every file, in label order. */
export function loadAll() {
  return LABELS.flatMap(loadCorpus);
}

/** Cheap word count, matching what extractFeatures will tokenize on. */
export function wordCount(text) {
  const m = text.match(/[a-z0-9']+/gi);
  return m ? m.length : 0;
}
