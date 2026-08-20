import { describe, it, expect } from 'vitest';
import { formatting } from '../../src/detector/formatting.js';
import { extractFeatures } from '../../src/detector/features.js';
import { loadCorpus } from '../corpus.js';

const run = (text) => formatting(extractFeatures(text), {});
const fixture = (label, id) => loadCorpus(label).find((p) => p.id === id).text;

describe('synthetic formatting', () => {
  it('fires on a post built out of one-line paragraphs', () => {
    const result = run(fixture('ai', 'ai-003'));
    expect(result.triggered).toBe(true);
    expect(result.evidence.join(' ')).toMatch(/single short line/);
  });

  it('normalizes by length: a long post is not penalized for having more of everything', () => {
    const beat = 'This is a short beat.\n\n';
    const short = beat.repeat(6);
    const long = beat.repeat(20);
    expect(run(long).score).toBe(run(short).score);
  });

  it.each(['—', '–', '--'])('treats one %s separator in a short post as weak evidence', (dash) => {
    const result = run(`Shipping today ${dash} please report accessibility issues right away after release.`);
    expect(result).toMatchObject({ triggered: true, score: 0.5 });
    expect(result.evidence).toContain('short post uses a dash separator');
  });

  it('one weak sub-signal alone is not enough', () => {
    // Colon-led lines only: a common way to write structured human notes.
    const colonsOnly = [
      'Status for the week:',
      '',
      'Shipped: the export endpoint, after two rounds of review that caught a',
      'pagination bug we had shipped and reverted twice before.',
      '',
      'Blocked: the vendor has not returned the sandbox credentials, so the',
      'reconciliation work has not started and will not start this week.',
      '',
      'Next: I am picking up the migration if the credentials do not arrive by',
      'Wednesday, because otherwise nobody has anything to do on Thursday.'
    ].join('\n');
    expect(run(colonsOnly).triggered).toBe(false);
  });

  it('a whole post of one-line paragraphs is a cluster on its own', () => {
    const fragmented = [
      'Most people get this wrong.',
      '',
      'They think it is about effort.',
      '',
      'It is about attention.',
      '',
      'And attention is finite.',
      '',
      'That changes everything.',
      '',
      'Protect it accordingly.'
    ].join('\n');
    expect(run(fragmented).triggered).toBe(true);
  });
});

describe('synthetic formatting on human posts', () => {
  it.each([
    ['human-004', 'meeting notes with bullets and a colon intro'],
    ['human-051', 'a bulleted list with commentary'],
    ['human-016', 'a labelled table of numbers, colon-heavy by nature']
  ])('does not fire on %s (%s)', (id) => {
    expect(run(fixture('human', id)).triggered).toBe(false);
  });

  it('the one human post that matches stays at the floor', () => {
    // human-084 uses "What has consistently worked:" as section headings.
    const result = run(fixture('human', 'human-084'));
    expect(result.score).toBeLessThanOrEqual(0.4);
  });
});
