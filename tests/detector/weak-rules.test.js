import { describe, it, expect } from 'vitest';
import { vocabulary } from '../../src/detector/vocabulary.js';
import { engagement } from '../../src/detector/engagement.js';
import { hashtags } from '../../src/detector/hashtags.js';
import { extractFeatures } from '../../src/detector/features.js';
import { analyze, STRONG_RULES, RULES } from '../../src/detector/scoring.js';
import { loadCorpus } from '../corpus.js';

const feats = (text) => extractFeatures(text);
const fixture = (label, id) => loadCorpus(label).find((p) => p.id === id).text;

describe('vocabulary', () => {
  it('ignores a single group, however many words from it appear', () => {
    const oneGroup = 'The journey has been meaningful and full of purpose and growth and impact.';
    expect(vocabulary(feats(oneGroup), {}).triggered).toBe(false);
  });

  it('fires only when groups co-occur', () => {
    const twoGroups = 'The journey has been meaningful. Ultimately, purpose is what matters.';
    expect(vocabulary(feats(twoGroups), {}).triggered).toBe(true);
  });

  it('merges user terms without dropping the seeds', () => {
    const settings = { customVocabulary: { inspiration: ['flywheel'] } };
    const text = 'Ultimately the flywheel is what matters here.';
    expect(vocabulary(feats(text), settings).triggered).toBe(true);
    expect(vocabulary(feats('Ultimately the journey matters.'), settings).triggered).toBe(true);
  });
});

describe('engagement', () => {
  it('fires on a closing call to action', () => {
    expect(engagement(feats('Great teams argue well. Agree?'), {}).triggered).toBe(true);
  });

  it('is capped below full strength even with several calls to action', () => {
    const stacked = 'Thoughts? Agree? What would you add? 👇 Let me know in the comments.';
    expect(engagement(feats(stacked), {}).score).toBeLessThanOrEqual(0.6);
  });

  it('a human asking a genuine question cannot be hidden by it', () => {
    // Asking the network something is what the platform is for. The rule may
    // fire; the architecture is what guarantees it stays harmless.
    expect(STRONG_RULES).not.toContain('engagement');
    const text = `${fixture('human', 'human-007')}\n\nThoughts?`;
    const result = analyze(text, { mode: 'hide' });
    expect(result.verdict).not.toBe('hide');
  });
});

describe('hashtags', () => {
  it('ignores a few topical tags', () => {
    expect(hashtags(feats('Shipped it. #rust #exif #sqlite'), {}).triggered).toBe(false);
  });

  it('fires on a block of broad audience tags', () => {
    const block = 'Some thoughts.\n\n#Leadership #GrowthMindset #Motivation #Success';
    expect(hashtags(feats(block), {}).triggered).toBe(true);
  });

  it('does not fire on the human post that uses hashtags', () => {
    expect(hashtags(feats(fixture('human', 'human-006')), {}).triggered).toBe(false);
  });
});

describe('score-threshold hiding', () => {
  it('allows enabled weak rules to hide when their combined score reaches the user threshold', () => {
    const weak = Object.keys(RULES).filter((id) => !STRONG_RULES.includes(id));
    const rules = Object.fromEntries(
      weak.map((id) => [id, () => ({ rule: id, triggered: true, score: 1, evidence: ['x'] })])
    );
    expect(analyze('word '.repeat(200), { mode: 'hide' }, rules).verdict).toBe('hide');
  });
});
