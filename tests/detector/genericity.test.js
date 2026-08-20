import { describe, it, expect } from 'vitest';
import { genericity } from '../../src/detector/genericity.js';
import { extractFeatures } from '../../src/detector/features.js';
import { loadCorpus } from '../corpus.js';

const run = (text) => genericity(extractFeatures(text), {});
const fixture = (label, id) => loadCorpus(label).find((p) => p.id === id).text;

describe('genericity', () => {
  it('fires on abstract writing with nothing concrete in it', () => {
    const result = run(fixture('ai', 'ai-014'));
    expect(result.triggered).toBe(true);
    expect(result.evidence.join(' ')).toMatch(/abstract vocabulary/);
  });

  it('requires low specificity as well as high abstraction', () => {
    // human-010 is the most abstraction-dense post in the human corpus. It does
    // not fire because it is full of numbers, which is the whole point of the
    // AND: abstraction alone is a subject, not a symptom.
    const result = run(fixture('human', 'human-010'));
    expect(result.triggered).toBe(false);
  });

  it('adding concrete detail to an abstract post silences it', () => {
    const abstract = [
      'Transformation requires alignment, and alignment requires clarity of',
      'communication across the organization. Without that clarity the',
      'implementation of any initiative becomes an exercise in negotiation',
      'rather than execution. Accountability follows from visibility, and',
      'visibility follows from a shared understanding of the direction.',
      'Engagement is the consequence, never the objective, of that process.'
    ].join(' ');
    expect(run(abstract).triggered).toBe(true);

    const withDetail = `${abstract} We ran this with 14 people in Pune during March 2024 and the migration took 6 weeks.`;
    expect(run(withDetail).triggered).toBe(false);
  });
});

describe('genericity on abstract human posts', () => {
  // Reflective human posts about intangible subjects are the exact shape this
  // detector is most likely to get wrong. These are the ones to watch.
  it.each([
    ['human-023', 'a manager reflecting on what the job actually is'],
    ['human-048', 'an opinion about culture being a staffing problem'],
    ['human-046', 'letting a junior struggle, no numbers in it at all'],
    ['human-060', 'advice about writing, entirely non-technical']
  ])('does not fire on %s (%s)', (id) => {
    expect(run(fixture('human', id)).triggered).toBe(false);
  });
});
