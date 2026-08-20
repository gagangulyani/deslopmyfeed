import { describe, it, expect } from 'vitest';
import { extractFeatures } from '../../src/detector/features.js';

describe('extractFeatures input shapes', () => {
  it('accepts a bare string, as the corpus harness passes', () => {
    const features = extractFeatures('Hello world');
    expect(features.wordCount).toBe(2);
    expect(features.headline).toBeNull();
    expect(features.reactions).toBeNull();
    expect(features.comments).toBeNull();
  });

  it('carries the structural fields a post object brings', () => {
    const features = extractFeatures({
      text: 'Hello world',
      headline: 'Founder at Example Corp',
      reactions: 12,
      comments: 3
    });
    expect(features.headline).toBe('Founder at Example Corp');
    expect(features.reactions).toBe(12);
    expect(features.comments).toBe(3);
  });

  it('treats missing structural fields as unknown, not zero', () => {
    const features = extractFeatures({ text: 'Hello world' });
    expect(features.headline).toBeNull();
    expect(features.reactions).toBeNull();
    expect(features.comments).toBeNull();
  });
});

describe('Unicode and concrete-context extraction', () => {
  it('normalizes presentation glyphs before counting words', () => {
    const features = extractFeatures('𝗧𝗵𝗲 𝗙𝗶𝗿𝘀𝘁 𝗦𝗾𝘂𝗮𝗿𝗲 𝗶𝘀 𝗵𝗲𝗿𝗲');
    expect(features.wordCount).toBe(5);
  });

  it('recognizes a first-person account with distinct real-world anchors', () => {
    const features = extractFeatures(
      'I hosted a meetup with Anuvrat and Nupur in Delhi last Saturday. I shared the event link after June 20th.'
    );
    expect(features.concreteContext).toBe(true);
  });

  it('does not infer concrete context from generic first-person prose alone', () => {
    expect(extractFeatures('I think we should keep learning and I want to grow together.').concreteContext).toBe(false);
  });
});

describe('dash feature extraction', () => {
  it('counts em dashes, en dashes, and double hyphens as dash separators', () => {
    const features = extractFeatures('One — two – three -- four');
    expect(features.emDashCount).toBe(3);
  });

  it('does not count a single hyphen as a dash separator', () => {
    expect(extractFeatures('a well-known example').emDashCount).toBe(0);
  });
});

describe('the Hinglish scope guard', () => {
  it('flags romanized Hindi once three distinct markers appear', () => {
    expect(extractFeatures('yeh update bahut important hai, matlab seriously').hinglish).toBe(true);
  });

  it('needs three distinct markers, so one stray quoted word is not a verdict', () => {
    const text = 'she said hai and then continued in perfectly ordinary english for a while';
    expect(extractFeatures(text).hinglish).toBe(false);
  });

  it('never flags plain English', () => {
    expect(extractFeatures('we shipped the feature on tuesday and customers liked it').hinglish).toBe(false);
  });
});
