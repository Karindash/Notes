const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {window: {}};

function load(file) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}

load('js/nback-engine.js');
load('js/task-registry.js');
load('js/profile-engine.js');

const engine = context.window.HCCTNBackEngine;
const registry = context.window.HCCTTaskRegistry;
const profile = context.window.HCCTProfileEngine;

assert.equal(registry.length, 1);
assert.equal(registry[0].id, 'nback');
assert.equal(registry[0].module, engine);
assert.equal(engine.policyType, 'capability');
assert.equal(engine.levels.length, 12);
assert.equal(engine.statusPolicy([]).status, 'Unassessed');

function block(dprime, ts, overrides = {}) {
  return {dprime, ts, levelId: 1, mode: 'assessment', valid: true, ...overrides};
}

assert.equal(engine.statusPolicy([block(0.99, '2026-01-01')]).status, 'Not yet');
assert.equal(engine.statusPolicy([block(1, '2026-01-01')]).status, 'Developing');
assert.equal(engine.statusPolicy([block(2, '2026-01-01')]).status, 'Mastered');
assert.equal(engine.statusPolicy([block(1, '2026-01-01')]).evidence, 'Low');
assert.equal(engine.statusPolicy([block(1, '2026-01-01'), block(1, '2026-01-02')]).evidence, 'Moderate');
const threeBlocks = [
  block(1, '2026-01-01'),
  block(1, '2026-01-02'),
  block(1, '2026-01-03')
];
assert.equal(engine.statusPolicy(threeBlocks).evidence, 'Better');
assert.equal(engine.levelStats(threeBlocks, 1).status, 'Developing');
assert.equal(engine.levelStats([], 1).status, 'Unassessed');

const rolling = engine.statusPolicy([
  block(0.2, '2026-01-01'),
  block(0.5, '2026-01-02'),
  block(2.1, '2026-01-03'),
  block(2.4, '2026-01-04'),
  block(4, '2026-01-05', {valid: false}),
  block(4, '2026-01-06', {mode: 'practice'})
]);
assert.equal(rolling.n, 4);
assert.equal(rolling.first, 0.2);
assert.equal(rolling.latest, 2.4);
assert.ok(Math.abs(rolling.meanD - (0.5 + 2.1 + 2.4) / 3) < 1e-12);
assert.equal(rolling.status, 'Developing');

assert.equal(profile.calibrationStatus(null), 'Unassessed');
assert.equal(profile.calibrationStatus(0.799), 'Cautious');
assert.equal(profile.calibrationStatus(0.8), 'Near-optimal');
assert.equal(profile.calibrationStatus(1.2), 'Near-optimal');
assert.equal(profile.calibrationStatus(1.201), 'Risk-seeking');

const nbackBlock = {
  ts: '2026-01-01T00:00:00.000Z',
  levelId: 1,
  n: 0,
  dual: false,
  ms: 2500,
  seed: 42,
  valid: true,
  flags: [],
  dprime: 1.5,
  mods: {letter: {d: 1.5}},
  rt: 500,
  lureFAs: 0,
  lureTrials: 0,
  device: {hz: 60}
};
const otherTask = {
  id: 'example',
  name: 'Example task',
  module: {profile: {metricKey: 'accuracy', metricName: 'Accuracy'}}
};
const records = profile.collectTaskBlocks([registry[0], otherTask], id =>
  id === 'nback'
    ? [nbackBlock]
    : [{levelId: 2, seed: 7, valid: true, flags: ['needs, review'], metrics: {accuracy: 0.75}}]
);
const csv = profile.toCSV(records);
const [header, nbackRow, otherRow] = csv.split('\n');
const legacyHeader = 'ts,levelId,n,dual,ms,seed,valid,flags,dprime,dLetter,dPos,rt,lureFAs,lureTrials,hz';
assert.equal(
  header,
  'taskId,levelId,seed,valid,flags,primaryMetricName,primaryMetricValue,' + legacyHeader
);
assert.ok(nbackRow.startsWith('nback,1,42,true,,Sensitivity (d′),1.5,'));
assert.ok(otherRow.startsWith('example,2,7,true,"needs, review",Accuracy,0.75,'));
assert.ok(otherRow.endsWith(','.repeat(14)));

const exported = JSON.parse(profile.toJSON(records));
assert.equal(exported.length, 2);
assert.equal(exported[0].taskId, 'nback');
assert.equal(exported[1].taskId, 'example');

console.log('Foundation tests passed.');
