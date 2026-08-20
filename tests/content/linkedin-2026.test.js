// @vitest-environment jsdom
/**
 * The markup shape observed on a live feed in August 2026, after LinkedIn
 * moved to build-hashed class names.
 *
 * Only the structure is copied here — element nesting, attribute names, the
 * `componentkey`/`data-testid`/`role` anchors. Every piece of text is fixture
 * text and every name is invented, so no real post or real person is committed
 * (tests/fixtures/README.md). Class names are included as hashes precisely
 * because nothing is allowed to select on them.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { findPosts, readPost, resetProcessed } from '../../src/content/post-detector.js';
import { loadCorpus } from '../corpus.js';

const slop = loadCorpus('ai').find((p) => p.id === 'ai-001').text;

/** One post, shaped the way LinkedIn shapes them now. */
function post({ key = 'AbC123', text = 'body', author = 'Jane Doe', comment = null } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = '_2cb07017 _40e147aa _1d9c1239';
  wrapper.id = `expanded${key}FeedType_MAIN_FEED_RELEVANCE`;
  wrapper.setAttribute('componentkey', `expanded${key}FeedType_MAIN_FEED_RELEVANCE`);

  const item = document.createElement('div');
  item.setAttribute('role', 'listitem');
  item.setAttribute('componentkey', `expanded${key}FeedType_MAIN_FEED_RELEVANCE`);
  item.className = '_9840af22';

  const inner = document.createElement('div');
  inner.setAttribute('data-display-contents', 'true');

  const body = document.createElement('div');
  body.setAttribute('componentkey', key);
  body.innerHTML = `
    <h2><span>Feed post</span></h2>
    <div class="_264e4cf3">
      <a href="https://www.linkedin.com/in/jane-doe/" componentkey="${key}-actor">
        <figure><svg role="img" aria-label="View ${author}’s profile"></svg></figure>
      </a>
    </div>
    <span tabindex="-1" data-testid="expandable-text-box"></span>`;
  body.querySelector('[data-testid="expandable-text-box"]').textContent = text;

  if (comment) {
    const thread = document.createElement('div');
    thread.setAttribute('componentkey', `replaceableComment_urn:li:comment:(urn:li:activity:1,2)`);
    const box = document.createElement('span');
    box.setAttribute('data-testid', 'expandable-text-box');
    box.textContent = comment;
    thread.appendChild(box);
    body.appendChild(thread);
  }

  inner.appendChild(body);
  item.appendChild(inner);
  wrapper.appendChild(item);
  return wrapper;
}

function feed(...posts) {
  document.body.textContent = '';
  const main = document.createElement('div');
  main.setAttribute('data-testid', 'mainFeed');
  for (const p of posts) main.appendChild(p);
  document.body.appendChild(main);
  return main;
}

beforeEach(() => {
  resetProcessed();
  document.body.textContent = '';
});

describe('the 2026 feed markup', () => {
  it('finds every post', () => {
    feed(post({ key: 'a' }), post({ key: 'b' }), post({ key: 'c' }));
    expect(findPosts(document)).toHaveLength(3);
  });

  // The wrapper and the listitem both match, so without the outermost-only
  // filter every post would be counted and judged twice.
  it('returns one element per post even though two selectors match it', () => {
    feed(post({ key: 'a' }));
    const found = findPosts(document);
    expect(found).toHaveLength(1);
    expect(found[0].querySelectorAll('[data-testid="expandable-text-box"]')).toHaveLength(1);
  });

  it('reads the post body and the author', () => {
    feed(post({ text: slop, author: 'Alex Rivera' }));
    const read = readPost(findPosts(document)[0]);
    expect(read.skip).toBeNull();
    expect(read.text).toBe(slop);
    expect(read.author).toBe('Alex Rivera');
  });

  // A post's own comment thread reuses data-testid="expandable-text-box".
  it('judges the post, not the first comment underneath it', () => {
    feed(post({ text: slop, comment: 'Congratulations, well deserved!' }));
    const read = readPost(findPosts(document)[0]);
    expect(read.text).toBe(slop);
    expect(read.text).not.toContain('Congratulations');
  });

  it('strips the see-more control out of the text it judges', () => {
    const el = post({ text: slop });
    const box = el.querySelector('[data-testid="expandable-text-box"]');
    const button = document.createElement('button');
    button.setAttribute('data-testid', 'expandable-text-button');
    button.textContent = '…more';
    box.appendChild(button);

    feed(el);
    const read = readPost(findPosts(document)[0]);
    expect(read.skip).toBeNull();
    expect(read.text).toBe(slop);
  });

  it('never selects on a build-hashed class', () => {
    feed(post({ key: 'a' }));
    // Rehash every class the way a LinkedIn deploy would, and expect no change.
    for (const el of document.querySelectorAll('[class]')) el.className = '_deadbeef _cafe1234';
    expect(findPosts(document)).toHaveLength(1);
    expect(readPost(findPosts(document)[0]).skip).toBeNull();
  });

  it('still reads pre-2026 markup', () => {
    document.body.textContent = '';
    const legacy = document.createElement('div');
    legacy.setAttribute('data-id', 'urn:li:activity:1');
    legacy.innerHTML = '<div class="update-components-text"></div>';
    legacy.querySelector('.update-components-text').textContent = slop;
    document.body.appendChild(legacy);

    expect(findPosts(document)).toHaveLength(1);
    expect(readPost(findPosts(document)[0]).text).toBe(slop);
  });
});
