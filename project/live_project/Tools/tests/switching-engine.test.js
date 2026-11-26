const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {window: {}};

function load(file) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}

load('js/settings/settings-store.js');
load('js/shared/task-engine-random.js');
load('js/shared/task-engine-statistics.js');
load('js/shared/task-engine-common.js');
load('js/switching/switching-config.js');
load('js/switching/switching-generation.js');
load('js/switching/switching-scoring.js');
load('js/switching/switching-policy.js');
load('js/switching/switching-engine.js');

const engine = context.window.HCCTSwitchingEngine;
const common = context.window.HCCTTaskEngineCommon;

assert.ok(Object.isFrozen(engine));
assert.equal(engine.id, 'switching');
assert.equal(engine.policyType, 'capability');
assert.equal(engine.levels.length, 10);
assert.equal(engine.profile.axis.min, 0.5);
assert.equal(engine.profile.axis.max, 1);
assert.equal(engine.statusOf(null), 'Unassessed');
assert.equal(engine.statusOf(0.75), 'Developing');
assert.equal(engine.statusOf(0.9), 'Mastered');
assert.match(engine.ruleText(10), /inconsistent mappings/i);
assert.match(engine.ruleText(10), /only at Level 10/i);
assert.match(engine.levelSummary(10), /very unlikely to be performed accurately/i);

const expectedSwitches = [0, 0, 39, 40, 40, 40, 40, 53, 79, 79];
for (const level of engine.levels) {
  const spec = engine.generate(level, 12345, 'assessment');
  const switches = spec.trials.filter(trial => trial.switched).length;
  assert.equal(spec.trials.length, 80);
  assert.equal(switches, expectedSwitches[level.id - 1], 'switch count at L' + level.id);
  assert.equal(spec.trials.some(trial => trial.digit === 5), false);
  for (let index = 1; index < spec.trials.length; index++) {
    assert.notEqual(spec.trials[index].digit, spec.trials[index - 1].digit, 'repeated digit at L' + level.id);
  }
  let keyRun = 1;
  for (let index = 1; index < spec.trials.length; index++) {
    keyRun = spec.trials[index].correctKey === spec.trials[index - 1].correctKey ? keyRun + 1 : 1;
    assert.ok(keyRun <= 4, 'correct key run at L' + level.id);
  }
  if (level.id === 3) {
    assert.equal(spec.trials.slice(0, 8).map(trial => trial.cue).join(''), 'PPMMPPMM');
  }
  if (level.id >= 8) {
    const counts = level.rules.map(rule => spec.trials.filter(trial => trial.cue === rule).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, 'balanced cues at L' + level.id);
  }
  if (level.id >= 3) {
    const congruent = spec.trials.filter(trial => trial.congruent).length / spec.trials.length;
    assert.ok(congruent >= 0.4 && congruent <= 0.6, 'congruency balance at L' + level.id + ': ' + congruent);
  }
}

assert.equal(engine.generate(8, 77, 'assessment').trials.length, 80);
assert.equal(engine.generate(8, 77, 'practice').trials.length, 16);
assert.deepEqual(
  engine.generate(8, 77, 'assessment').trials,
  engine.generate(8, 77, 'assessment').trials
);
assert.notDeepEqual(
  engine.generate(8, 77, 'assessment').trials,
  engine.generate(8, 78, 'assessment').trials
);

const mappingCases = [
  [1, 'P', 1, null, 'F'], [1, 'P', 2, null, 'J'],
  [2, 'M', 4, null, 'F'], [2, 'M', 6, null, 'J'],
  [8, 'V', 1, 'A', 'F'], [8, 'V', 1, 'B', 'J'],
  [10, 'P', 1, null, 'F'], [10, 'P', 2, null, 'J'],
  [10, 'M', 4, null, 'J'], [10, 'M', 6, null, 'F'],
  [10, 'V', 1, 'A', 'J'], [10, 'V', 1, 'B', 'F']
];
for (const [level, rule, digit, letter, expected] of mappingCases) {
  assert.equal(engine.correctKey(rule, digit, letter, level), expected);
}
assert.equal(engine.levels[0].csi, 0);
assert.equal(engine.levels[0].responseWindow, 3000);
assert.equal(engine.levels[1].csi, 0);
assert.equal(engine.levels[1].responseWindow, 3000);
assert.equal(engine.levels[9].cueFlash, 80);
assert.equal(engine.levels[9].responseWindow, 700);

const perfectSpec = engine.generate(4, 101, 'assessment');
const perfectResponses = perfectSpec.trials.map(trial => ({key: trial.correctKey, rt: trial.switched ? 620 : 500}));
const perfect = engine.score(4, perfectSpec, perfectResponses, 101);
assert.equal(perfect.accuracy, 1);
assert.equal(perfect.medianRt, 560);
assert.equal(perfect.switchCost.estimate, 120);
assert.ok(perfect.switchCost.lower <= 120 && perfect.switchCost.upper >= 120);
assert.equal(perfect.switchCost.reliable, true);
assert.equal(perfect.switchCorrect, 40);
assert.equal(perfect.repeatCorrect, 39);
assert.equal(perfect.switchCost.repeatRtCount, 39);
assert.equal(perfect.mixingCost, 'needs a baseline');
const firstTrialOutlier = perfectResponses.map(response => ({...response}));
firstTrialOutlier[0].rt = 10000;
const excludesFirstTrial = engine.score(4, perfectSpec, firstTrialOutlier, 101);
assert.equal(excludesFirstTrial.switchCost.estimate, 120);
assert.equal(excludesFirstTrial.switchCost.repeatRtCount, 39);

const withBaseline = engine.score(4, perfectSpec, perfectResponses, 101, [
  {levelId: 1, mode: 'assessment', valid: true, rt: 400},
  {levelId: 2, mode: 'assessment', valid: true, rt: 450}
]);
assert.equal(withBaseline.mixingCost, 75);
assert.equal(withBaseline.mixingCostByRule.P, 100);
assert.equal(withBaseline.mixingCostByRule.M, 50);
const noAssessmentBaseline = engine.score(4, perfectSpec, perfectResponses, 101, [
  {levelId: 1, mode: 'practice', valid: true, rt: 400},
  {levelId: 2, mode: 'assessment', valid: false, rt: 450}
]);
assert.equal(noAssessmentBaseline.mixingCost, 'needs a baseline');

const randomResponses = perfectSpec.trials.map((trial, index) => ({
  key: common.rng(index + 900)() < 0.5 ? 'F' : 'J',
  rt: 500
}));
const randomScore = engine.score(4, perfectSpec, randomResponses, 7);
assert.ok(randomScore.accuracy >= 0.35 && randomScore.accuracy <= 0.65);

const stuck = engine.score(1, engine.generate(1, 25, 'assessment'),
  new Array(80).fill({key: 'F', rt: 500}), 25);
assert.ok(engine.validate(stuck, 1, {}).flags.includes('stuck_key'));
assert.equal(engine.validate(stuck, 1, {max: 301}).valid, false);
assert.equal(engine.validate(stuck, 1, {tabHidden: true}).valid, false);
const noResponses = engine.score(1, engine.generate(1, 2, 'assessment'), [], 2);
assert.equal(engine.validate(noResponses, 1, {}).valid, false);
assert.ok(engine.validate(noResponses, 1, {}).flags.includes('no_responses'));

const mixedWithOmissions = engine.score(3, engine.generate(3, 5, 'assessment'),
  new Array(80).fill(null), 5);
assert.ok(engine.validate(mixedWithOmissions, 3, {}).flags.includes('omissions'));
assert.ok(engine.validate(mixedWithOmissions, 3, {}).flags.includes('few_switch_correct'));
const pureLowCount = engine.score(1, engine.generate(1, 5, 'assessment'), [], 5);
assert.equal(engine.validate(pureLowCount, 1, {}).flags.includes('few_switch_correct'), false);
const anticipatoryResponses = perfectSpec.trials.map(trial => ({key: trial.correctKey, rt: 100}));
assert.ok(engine.validate(engine.score(4, perfectSpec, anticipatoryResponses, 101), 4, {}).flags.includes('anticipations'));
const missingRtResponses = perfectSpec.trials.map(trial => ({key: trial.correctKey, rt: null}));
const missingRtScore = engine.score(4, perfectSpec, missingRtResponses, 101);
const missingRtValidation = engine.validate(missingRtScore, 4, {});
assert.equal(missingRtScore.switchCorrect, 40);
assert.equal(missingRtScore.repeatCorrect, 39);
assert.equal(missingRtValidation.flags.includes('few_switch_correct'), false);
assert.equal(missingRtValidation.flags.includes('few_repeat_correct'), false);

function block(accuracy, ts, overrides = {}) {
  return {accuracy, ts, levelId: 1, mode: 'assessment', valid: true, ...overrides};
}
assert.equal(engine.statusPolicy([]).status, 'Unassessed');
assert.equal(engine.statusPolicy([block(0.75, '2026-01-01')]).status, 'Developing');
assert.equal(engine.statusPolicy([block(0.9, '2026-01-01')]).status, 'Mastered');
const rolling = engine.statusPolicy([
  block(0.2, '2026-01-01'),
  block(0.5, '2026-01-02'),
  block(0.9, '2026-01-03'),
  block(1, '2026-01-04'),
  block(1, '2026-01-05', {valid: false}),
  block(1, '2026-01-06', {mode: 'practice'})
]);
assert.equal(rolling.n, 4);
assert.equal(rolling.meanAccuracy, (0.5 + 0.9 + 1) / 3);
assert.equal(rolling.meanValue, rolling.meanAccuracy);
assert.equal(rolling.status, 'Developing');
assert.equal(rolling.evidence, 'Better');
assert.equal(engine.suggestedLevel([block(1, '2026-01-01')]), 2);
assert.equal(engine.flagText('timing_invalid').includes('discard'), true);

console.log('Switching engine tests passed.');
