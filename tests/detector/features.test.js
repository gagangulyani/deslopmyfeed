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
