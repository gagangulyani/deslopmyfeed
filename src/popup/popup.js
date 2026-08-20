import { DEFAULT_SETTINGS, loadSettings, saveSettings, mergeSettings } from '../storage/settings.js';
import { RULE_LABELS } from '../detector/scoring.js';

/**
 * The panel is generated from the settings object itself, so a rule added to
 * the schema appears here without anyone remembering to edit markup.
 */

const MODES = [
  ['off', 'Off', 'Analyze nothing.'],
  ['warn', 'Warn', 'Mark posts, hide nothing.'],
  ['hide', 'Hide', 'Collapse posts, always restorable.']
];

const SENSITIVITIES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High']
];

const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark']
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title) {
  const node = el('section', 'section');
  node.appendChild(el('h2', 'section-title', title));
  return node;
}

function toggle(label, checked, onChange) {
  const row = el('label', 'row');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  row.appendChild(input);
  row.appendChild(el('span', 'row-label', label));
  return row;
}

function choice(name, options, current, onChange) {
  const group = el('div', 'choices');
  group.setAttribute('role', 'radiogroup');
  for (const [value, label, hint] of options) {
    const row = el('label', 'row');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = current === value;
    input.addEventListener('change', () => onChange(value));
    row.appendChild(input);
    row.appendChild(el('span', 'row-label', label));
    if (hint) row.appendChild(el('span', 'row-hint', hint));
    group.appendChild(row);
  }
  return group;
}

/**
 * @param {Element} root
 * @param {typeof DEFAULT_SETTINGS} settings
 * @param {(patch: Object) => void} onChange
 */
export function renderInto(root, settings, onChange) {
  const config = mergeSettings(settings);
  root.textContent = '';

  root.appendChild(toggle('Enable DeSlopMyFeed', config.enabled, (enabled) => onChange({ enabled })));

  const mode = section('Mode');
  mode.appendChild(choice('mode', MODES, config.mode, (value) => onChange({ mode: value })));
  root.appendChild(mode);

  const sensitivity = section('Sensitivity');
  sensitivity.appendChild(
    choice('sensitivity', SENSITIVITIES, config.sensitivity, (value) => onChange({ sensitivity: value }))
  );
  root.appendChild(sensitivity);

  const rules = section('Signals');
  for (const [id, label] of Object.entries(RULE_LABELS)) {
    rules.appendChild(
      toggle(label, config.rules[id] !== false, (on) =>
        onChange({ rules: { ...config.rules, [id]: on } })
      )
    );
  }
  root.appendChild(rules);

  const theme = section('Theme');
  theme.appendChild(choice('theme', THEMES, config.theme, (value) => onChange({ theme: value })));
  root.appendChild(theme);

  const diagnostics = section('Diagnostics');
  diagnostics.appendChild(
    toggle('Show what the extension sees', config.debug === true, (debug) => onChange({ debug }))
  );
  diagnostics.appendChild(
    el('p', 'section-hint', 'Tags every post on the feed with the stage it reached and its score. Changes nothing about what gets filtered.')
  );
  root.appendChild(diagnostics);

  applyTheme(config.theme);
  return root;
}

/** 'system' leaves the attribute unset so the media query decides. */
export function applyTheme(theme, target = document.documentElement) {
  if (theme === 'light' || theme === 'dark') target.setAttribute('data-theme', theme);
  else target.removeAttribute('data-theme');
}

async function main() {
  const root = document.getElementById('app');
  if (!root) return;

  let settings;
  try {
    settings = await loadSettings();
  } catch {
    settings = mergeSettings(DEFAULT_SETTINGS);
  }

  const onChange = async (patch) => {
    settings = mergeSettings({ ...settings, ...patch });
    renderInto(root, settings, onChange);
    try {
      await saveSettings(patch);
    } catch (err) {
      console.debug('[DeSlopMyFeed] could not save settings:', err);
    }
  };

  renderInto(root, settings, onChange);
}

// Skipped under test, where the module is imported for renderInto alone.
if (typeof document !== 'undefined' && document.getElementById('app')) main();
