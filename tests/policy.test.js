import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.js'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

/**
 * These are the project's promises, written as assertions instead of prose so
 * that breaking one fails the build rather than quietly contradicting
 * PRIVACY.md.
 */
describe('the extension makes no network requests of its own (spec §16)', () => {
  const NETWORK = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /new WebSocket/,
    /navigator\.sendBeacon/,
    /EventSource/,
    /importScripts/
  ];

  it.each(NETWORK.map((p) => [String(p)]))('no source file uses %s', (pattern) => {
    const regex = new RegExp(pattern.slice(1, pattern.lastIndexOf('/')));
    const offenders = sources
      .filter((file) => regex.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('the only dynamic import is the extension-local bootstrap', () => {
    const dynamic = sources.filter((file) => /\bawait import\(/.test(readFileSync(file, 'utf8')));
    expect(dynamic.map((f) => relative(ROOT, f))).toEqual(['src/content/bootstrap.js']);
    expect(readFileSync(join(ROOT, 'src/content/bootstrap.js'), 'utf8'))
      .toMatch(/chrome\.runtime\.getURL/);
  });

  it('loads no remote stylesheets or fonts', () => {
    for (const file of walk(join(ROOT, 'src')).filter((f) => /\.(css|html)$/.test(f))) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/https?:\/\//);
    }
  });
});

describe('no LinkedIn control is ever operated (spec §19)', () => {
  it('nothing in src clicks, submits or focuses a page element', () => {
    const offenders = sources.filter((file) => {
      const code = readFileSync(file, 'utf8');
      return /\.click\(\)|\.submit\(\)|dispatchEvent\(new MouseEvent/.test(code);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});

describe('permissions are the minimum (spec §18)', () => {
  it('requests storage and nothing else', () => {
    expect(manifest.permissions).toEqual(['storage']);
  });

  it('requests no host permissions and no optional permissions', () => {
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_permissions).toBeUndefined();
  });

  it.each(['tabs', 'cookies', 'history', 'webRequest', 'scripting', '<all_urls>'])(
    'never asks for %s',
    (permission) => {
      expect(JSON.stringify(manifest)).not.toContain(`"${permission}"`);
    }
  );

  it('scopes content scripts and web accessible resources to linkedin.com', () => {
    for (const entry of manifest.content_scripts) {
      expect(entry.matches).toEqual(['https://www.linkedin.com/*']);
    }
    for (const entry of manifest.web_accessible_resources) {
      expect(entry.matches).toEqual(['https://www.linkedin.com/*']);
    }
  });

  it('declares no background service worker', () => {
    // Nothing needs to run when the user is not looking at LinkedIn.
    expect(manifest.background).toBeUndefined();
  });
});

describe('the packaged extension is internally consistent', () => {
  const globToPaths = (pattern) => {
    const dir = join(ROOT, pattern.slice(0, pattern.lastIndexOf('/')));
    const ext = pattern.slice(pattern.lastIndexOf('*') + 1);
    return readdirSync(dir).filter((f) => f.endsWith(ext));
  };

  it('every file the manifest names exists', () => {
    const referenced = [
      ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css ?? [])]),
      manifest.action.default_popup
    ];
    for (const file of referenced) {
      expect(existsSync(join(ROOT, file)), `${file} is missing`).toBe(true);
    }
  });

  it('web accessible resources cover every module the bootstrap can reach', () => {
    // A module missing from this list loads fine under Vitest and fails only in
    // Chrome, which is the worst possible place to find out.
    const exposed = new Set(
      manifest.web_accessible_resources.flatMap((entry) =>
        entry.resources.flatMap((pattern) => globToPaths(pattern).map(
          (f) => `${pattern.slice(0, pattern.lastIndexOf('/'))}/${f}`
        ))
      )
    );
    // The popup is an extension page and loads its own modules directly; only
    // what the injected bootstrap imports has to be exposed to linkedin.com.
    const bootstrap = 'src/content/bootstrap.js';
    const injected = sources
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((f) => f !== bootstrap && !f.startsWith('src/popup/'));

    for (const file of injected) {
      expect(exposed.has(file), `${file} is not web-accessible`).toBe(true);
    }
  });

  it('every import in src resolves to a file that exists', () => {
    for (const file of sources) {
      const code = readFileSync(file, 'utf8');
      for (const match of code.matchAll(/from '(\.[^']+)'/g)) {
        const target = join(dirname(file), match[1]);
        expect(existsSync(target), `${relative(ROOT, file)} imports missing ${match[1]}`).toBe(true);
      }
    }
  });
});

describe('post content is never persisted (spec §15)', () => {
  it('only the settings module writes to storage', () => {
    const writers = sources.filter((file) =>
      /chrome\.storage\.[a-z]+\.set/.test(readFileSync(file, 'utf8'))
    );
    expect(writers.map((f) => relative(ROOT, f))).toEqual(['src/storage/settings.js']);
  });
});
