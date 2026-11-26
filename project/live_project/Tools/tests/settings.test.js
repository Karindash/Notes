const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storage = new Map();
const defaults = {LEVELS: [{id: 1}, {id: 2}], amount: 5, label: 'Default', values: ['a', 'b']};
const validate = config => config.amount > 0 ? true : 'amount must be positive.';

function createSettings() {
  const context = {
    window: {
      localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, value)
      }
    }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js/settings/settings-store.js'), 'utf8'),
    context,
    {filename: 'js/settings/settings-store.js'}
  );
  context.window.HCCTSettings.applyTaskConfig('demo', defaults, validate);
  return context.window.HCCTSettings;
}

const settings = createSettings();
const candidate = settings.makeConfiguration();
candidate.defaultTaskId = 'demo';
candidate.defaultLevelByTask.demo = 2;
candidate.tasks.demo.amount = 12;
candidate.appearance = {theme: 'light', textScale: 1.2, accent: '#123abc'};

assert.equal(settings.saveConfiguration(candidate).ok, true);
assert.equal(settings.getDefaultTaskId([{id: 'demo'}]), 'demo');
assert.equal(settings.getDefaultLevel('demo', [{id: 1}, {id: 2}]), 2);
assert.equal(settings.makeConfiguration().tasks.demo.amount, 12);

const saved = storage.get('hcct-app-settings');
const reloaded = createSettings();
assert.equal(reloaded.makeConfiguration().tasks.demo.amount, 12);
assert.equal(reloaded.makeConfiguration().appearance.theme, 'light');

const invalid = reloaded.makeConfiguration();
invalid.tasks.demo.values = ['too', 'many', 'entries'];
const failed = reloaded.saveConfiguration(invalid);
assert.equal(failed.ok, false);
assert.match(failed.error, /array length/i);
assert.equal(storage.get('hcct-app-settings'), saved);

const unsafe = reloaded.makeConfiguration();
unsafe.tasks.demo.label = 'x" onclick="alert(1)';
const rejected = reloaded.saveConfiguration(unsafe);
assert.equal(rejected.ok, false);
assert.match(rejected.error, /unsupported text/i);

assert.equal(reloaded.resetConfiguration().ok, true);
assert.equal(reloaded.makeConfiguration().tasks.demo.amount, 5);
assert.equal(reloaded.makeConfiguration().defaultTaskId, 'demo');
console.log('Settings tests passed.');
