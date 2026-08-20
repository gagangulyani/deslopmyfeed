// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  findPosts, extractPost, isProcessed, markProcessed
} from '../../src/content/post-detector.js';

/** Minimal stand-in for LinkedIn's post markup. */
function post({ id = 'urn:li:activity:1', text = 'body', author = 'A Person', toggle = '' } = {}) {
  const el = document.createElement('div');
  el.setAttribute('data-id', id);
  el.innerHTML = `
    <div class="update-components-actor__title">${author}</div>
    <div class="update-components-text">${text}${toggle}</div>
  `;
  return el;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('findPosts', () => {
  it('finds posts by each supported selector', () => {
    document.body.innerHTML = `
      <div data-id="urn:li:activity:1"></div>
      <div data-urn="urn:li:activity:2"></div>
      <div class="feed-shared-update-v2"></div>
    `;
    expect(findPosts(document)).toHaveLength(3);
  });

  it('returns the element itself when the mutation added the post', () => {
    const el = post();
    expect(findPosts(el)).toEqual([el]);
  });

  it('keeps only the outer post when one is reshared inside another', () => {
    const outer = post({ id: 'urn:li:activity:1' });
    const inner = post({ id: 'urn:li:activity:2' });
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(findPosts(document)).toEqual([outer]);
  });

  it('returns nothing for markup it does not recognize', () => {
    document.body.innerHTML = '<article class="some-new-linkedin-class">text</article>';
    expect(findPosts(document)).toEqual([]);
  });

  it('tolerates being handed something that is not an element', () => {
    expect(findPosts(null)).toEqual([]);
    expect(findPosts(document.createTextNode('x'))).toEqual([]);
  });
});

describe('extractPost', () => {
  it('reads the text and the author', () => {
    expect(extractPost(post({ text: 'Shipped the migration.', author: 'R. Iyer' })))
      .toEqual({ text: 'Shipped the migration.', author: 'R. Iyer' });
  });

  it('returns null when no known text container is present', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'urn:li:activity:1');
    el.innerHTML = '<div class="brand-new-markup">text</div>';
    expect(extractPost(el)).toBeNull();
  });

  it('strips LinkedIn controls out of the text', () => {
    const el = post({ text: 'Real content.', toggle: '<button class="see-more">see more</button>' });
    expect(extractPost(el).text).toBe('Real content.');
  });

  it('returns null for a post truncated behind "see more"', () => {
    // Clicking the control is forbidden, and judging the visible prefix would
    // mean judging an arbitrary fragment. Unanalyzable, so leave it alone.
    const el = post({
      text: 'This is the beginning of a long post that LinkedIn has cut off…',
      toggle: '<button class="see-more">see more</button>'
    });
    expect(extractPost(el)).toBeNull();
  });

  it('treats a three-dot truncation the same as an ellipsis character', () => {
    expect(extractPost(post({ text: 'Cut off here...' }))).toBeNull();
  });

  it('returns null when the container is empty', () => {
    expect(extractPost(post({ text: '' }))).toBeNull();
  });

  it('reports a missing author as null rather than guessing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="update-components-text">Body text here.</div>';
    expect(extractPost(el)).toEqual({ text: 'Body text here.', author: null });
  });

  it('does not modify the page while reading it', () => {
    const el = post({ text: 'Content.', toggle: '<button class="see-more">see more</button>' });
    const before = el.innerHTML;
    extractPost(el);
    expect(el.innerHTML).toBe(before);
  });
});

describe('processed marking', () => {
  it('tracks elements without keeping them alive', () => {
    const el = post();
    expect(isProcessed(el)).toBe(false);
    markProcessed(el);
    expect(isProcessed(el)).toBe(true);
  });
});
