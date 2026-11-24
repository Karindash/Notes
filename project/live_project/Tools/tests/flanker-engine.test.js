const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {window: {}};

for (const file of ['js/task-engine-common.js', 'js/flanker-engine.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}

const engine = context.window.HCCTFlankerEngine;
assert.ok(engine);
assert.equal(Object.isFrozen(engine), true);
assert.equal(engine.id, 'flanker');
assert.equal(engine.policyType, 'capability');
assert.equal(engine.levels.length, 10);
assert.equal(Object.isFrozen(engine.ui), false);
engine.ui.start = () => 'hook';
assert.equal(engine.ui.start(), 'hook');
engine.ui.start = null;

const keyGroup = {H: 'F', K: 'F', S: 'J', C: 'J'};
const maskLetters = new Set('B D F G J L M N P Q R T V W X Z'.split(' '));
const frequency = values => values.reduce((counts, value) => {
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});
const same = (left, right) => assert.deepEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));

for (const level of engine.levels) {
  const spec = engine.generate(level, 193 + level.id, 'assessment');
  assert.equal(spec.trials.length, 60, `L${level.id} assessment trials`);
  assert.equal(spec.N, 60);
  assert.equal(spec.scoredCount, 60);
  assert.equal(spec.practiceCount, 0);
  assert.equal(spec.trials.filter(trial => trial.scored).length, 60);
  assert.equal(spec.trials.filter(trial => !trial.scored).length, 0);

  const scored = spec.trials.filter(trial => trial.scored);
  const expectedTypes = level.id === 1 ? ['single'] : level.id === 2 ? ['neutral'] : ['congruent', 'incongruent'];
  assert.deepEqual([...new Set(scored.map(trial => trial.type))].sort(), expectedTypes.slice().sort(), `L${level.id} conditions`);
  if (level.id >= 3) {
    assert.deepEqual(frequency(scored.map(trial => trial.type)), {congruent: 30, incongruent: 30});
  } else {
    assert.equal(scored.length, 60);
  }
  for (const type of expectedTypes) {
    const trials = scored.filter(trial => trial.type === type);
    const keyCounts = frequency(trials.map(trial => trial.correctKey));
    assert.equal(keyCounts.F, trials.length / 2, `L${level.id} ${type} F balance`);
    assert.equal(keyCounts.J, trials.length / 2, `L${level.id} ${type} J balance`);
  }

  let lastTarget = null;
  let targetRun = 0;
  for (const trial of spec.trials) {
    assert.ok(Object.hasOwn(keyGroup, trial.target));
    assert.equal(trial.correctKey, keyGroup[trial.target]);
    assert.ok(trial.string.length === level.stringLength);
    assert.ok(trial.jitterMs >= 400 && trial.jitterMs <= 700);
    assert.equal(trial.exposureMs, level.exposureMs);
    assert.ok(trial.mask === null || [...trial.mask].every(letter => maskLetters.has(letter)));
    if (trial.target === lastTarget) targetRun++;
    else {
      lastTarget = trial.target;
      targetRun = 1;
    }
    assert.ok(targetRun <= 3, `L${level.id} target run`);
    if (trial.type === 'congruent') {
      assert.ok([...trial.string].every(letter => letter === trial.target));
    }
    if (trial.type === 'incongruent') {
      assert.ok([...trial.string].filter(letter => letter !== trial.target)
        .every(letter => keyGroup[letter] !== trial.correctKey));
    }
    if (trial.type === 'neutral' && level.stringLength > 1) {
      assert.ok([...trial.string].every((letter, index) => index === Math.floor(trial.string.length / 2)
        ? letter === trial.target
        : letter === 'X'));
    }
  }
}

assert.equal(engine.levels[9].exposureMs, 17);
assert.match(engine.ruleText(engine.levels[5]), /refresh rate/i);
assert.match(engine.ruleText(engine.levels[9]), /refresh rate/i);
same(engine.generate(engine.levels[2], 42, 'assessment'), engine.generate(engine.levels[2], 42, 'assessment'));
assert.notDeepEqual(
  JSON.parse(JSON.stringify(engine.generate(engine.levels[2], 42, 'assessment'))),
  JSON.parse(JSON.stringify(engine.generate(engine.levels[2], 43, 'assessment')))
);
const practiceSpec = engine.generate(engine.levels[0], 42, 'practice');
assert.equal(practiceSpec.N, 12);
assert.equal(practiceSpec.trials.length, 12);
assert.equal(practiceSpec.scoredCount, 0);
assert.equal(practiceSpec.practiceCount, 12);
assert.ok(practiceSpec.trials.every(trial => !trial.scored && trial.practice));

function perfectResponses(spec, rtByType) {
  return spec.trials.map(trial => trial.scored
    ? {key: trial.correctKey, rtMs: rtByType[trial.type] || 500}
    : null);
}

const l3 = engine.levels[2];
const perfectSpec = engine.generate(l3, 73, 'assessment');
const perfect = engine.score(l3, perfectSpec, perfectResponses(perfectSpec, {congruent: 500, incongruent: 600}), 91);
assert.equal(perfect.conditions.congruent.accuracy, 1);
assert.equal(perfect.conditions.incongruent.accuracy, 1);
assert.equal(perfect.primaryAccuracy, 1);
assert.equal(perfect.conditions.congruent.medianRt, 500);
assert.equal(perfect.conditions.incongruent.medianRt, 600);
assert.equal(perfect.interferenceCost.estimate, 100);
assert.ok(perfect.interferenceCost.lower <= 100 && perfect.interferenceCost.upper >= 100);
assert.equal(perfect.reliability.status, 'reliable');
same(
  perfect.interferenceCost,
  engine.score(l3, perfectSpec, perfectResponses(perfectSpec, {congruent: 500, incongruent: 600}), 91).interferenceCost
);

const alwaysLeft = perfectSpec.trials.map(trial => trial.scored ? {key: 'F', rtMs: 500} : null);
const leftScore = engine.score(l3, perfectSpec, alwaysLeft, 91);
assert.ok(engine.validate(leftScore, l3, {}).flags.includes('stuck_key'));
const noResponses = engine.score(l3, perfectSpec, perfectSpec.trials.map(() => null), 91);
assert.equal(engine.validate(noResponses, l3, {}).valid, false);
assert.ok(engine.validate(noResponses, l3, {}).flags.includes('no_responses'));
assert.equal(engine.validate(perfect, l3, {max: 301}).valid, false);
assert.ok(engine.validate(perfect, l3, {max: 301}).flags.includes('timing_invalid'));

for (const id of [1, 2]) {
  const level = engine.levels[id - 1];
  const spec = engine.generate(level, 102, 'assessment');
  const score = engine.score(level, spec, perfectResponses(spec, {single: 450, neutral: 450}), 1);
  assert.equal(score.interferenceCost.available, false);
  assert.equal(score.interferenceCost.reason, 'unavailable');
  assert.equal(score.primaryAccuracy, 1);
}

const omissions = perfectSpec.trials.map(trial => trial.scored ? null : null);
const omissionScore = engine.score(l3, perfectSpec, omissions, 1);
assert.ok(engine.validate(omissionScore, l3, {}).flags.includes('high_omissions'));
assert.equal(engine.statusOf(0.7499), 'Not yet');
assert.equal(engine.statusOf(0.75), 'Developing');
assert.equal(engine.statusOf(0.9), 'Mastered');
assert.equal(engine.statusPolicy([]).status, 'Unassessed');
assert.equal(engine.statusPolicy([]).meanValue, null);
assert.equal(engine.statusPolicy([{levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.9}]).evidence, 'Low');
assert.equal(engine.statusPolicy([
  {levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.7, ts: '2026-01-01'},
  {levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.8, ts: '2026-01-02'}
]).evidence, 'Moderate');
const rolling = engine.statusPolicy([
  {levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.2, ts: '2026-01-01'},
  {levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.8, ts: '2026-01-02'},
  {levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.9, ts: '2026-01-03'},
  {levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.9, ts: '2026-01-04'},
  {levelId: 3, valid: false, mode: 'assessment', primaryAccuracy: 0, ts: '2026-01-05'},
  {levelId: 3, valid: true, mode: 'practice', primaryAccuracy: 0, ts: '2026-01-06'}
]);
assert.equal(rolling.n, 4);
assert.equal(rolling.status, 'Developing');
assert.equal(rolling.meanAccuracy, (0.8 + 0.9 + 0.9) / 3);
assert.equal(rolling.meanValue, rolling.meanAccuracy);
assert.equal(engine.statusPolicy([0, 1, 2].map(index => ({
  levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.75, ts: '2026-02-0' + (index + 1)
}))).status, 'Developing');
assert.equal(engine.statusPolicy([0, 1, 2].map(index => ({
  levelId: 3, valid: true, mode: 'assessment', primaryAccuracy: 0.9, ts: '2026-03-0' + (index + 1)
}))).status, 'Mastered');

console.log('Flanker engine tests passed.');
