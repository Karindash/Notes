const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {window: {}};
for (const file of ['js/task-engine-common.js', 'js/series-engine.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}

const engine = context.window.HCCTSeriesEngine;
assert.ok(Object.isFrozen(engine));
assert.equal(engine.id, 'series');
assert.equal(engine.policyType, 'capability');
assert.equal(engine.levels.length, 10);
assert.deepEqual(Array.from(engine.profile.axis.referenceLines, line => line.value), [5, 7]);

const expected = [
  {terms: 5, seconds: 20, families: ['C1'], underdetermined: 0},
  {terms: 5, seconds: 20, families: ['C1'], underdetermined: 0},
  {terms: 5, seconds: 20, families: ['C2'], underdetermined: 0},
  {terms: 6, seconds: 30, families: ['C3'], underdetermined: 0},
  {terms: 7, seconds: 30, families: ['C4'], underdetermined: 1},
  {terms: 6, seconds: 30, families: ['C5'], underdetermined: 1},
  {terms: 7, seconds: 45, families: ['C6', 'C7'], underdetermined: 1},
  {terms: 6, seconds: 45, families: ['C8'], underdetermined: 1},
  {terms: 7, seconds: 45, families: ['C9'], underdetermined: 1},
  {terms: [5, 7], seconds: 45, families: ['C6', 'C7', 'C9'], underdetermined: 4}
];
for (const [index, specification] of expected.entries()) {
  const level = engine.levels[index];
  assert.equal(level.id, index + 1);
  assert.equal(level.timeSeconds, specification.seconds);
  assert.equal(level.ms, specification.seconds * 1000);
  assert.equal(level.timeLimitMs, specification.seconds * 1000);
  assert.equal(level.underdetermined, specification.underdetermined);
  assert.deepEqual(Array.from(level.families), specification.families);
  assert.deepEqual(Array.isArray(level.terms) ? Array.from(level.terms) : [level.terms, level.terms],
    Array.isArray(specification.terms) ? specification.terms : [specification.terms, specification.terms]);
}

function signature(item) {
  return item.shownTerms.map(String).join(',');
}

function checkBounds(item) {
  const terms = item.shownTerms.concat(item.solvable ? [item.answer] : []);
  for (const raw of terms) {
    const text = String(raw);
    if (/^[A-Z]$/.test(text)) {
      assert.ok(text >= 'A' && text <= 'Z');
    } else {
      assert.match(text, /^[+-]?\d+$/);
      assert.ok(Math.abs(Number(text)) <= 9999);
    }
  }
}

const familyTermCounts = {C1: 5, C2: 5, C3: 6, C4: 7, C5: 6, C6: 7, C7: 7, C8: 6, C9: 7};
for (const family of Object.keys(familyTermCounts)) {
  const answersAcrossSeeds = new Set();
  for (let seed = 0; seed < 10000; seed++) {
    const item = engine.generateFamily(family, seed, familyTermCounts[family]);
    const predictions = Array.from(engine.consistentAnswers(item.shownTerms));
    assert.equal(item.solvable, true, family + ' seed ' + seed);
    assert.equal(predictions.length, 1, family + ' seed ' + seed);
    assert.equal(predictions[0], String(item.answer), family + ' seed ' + seed);
    checkBounds(item);
    if (family === 'C1' || family === 'C7') {
      for (const term of item.shownTerms) {
        if (/^[A-Z]$/.test(String(term))) assert.ok(String(term).charCodeAt(0) >= 65 && String(term).charCodeAt(0) <= 90);
      }
    }
    if (family === 'C7') {
      const complete = item.shownTerms.concat(item.answer);
      const letters = complete.filter(term => /^[A-Z]$/.test(String(term))).map(term => String(term).charCodeAt(0) - 64);
      const numbers = complete.filter(term => !/^[A-Z]$/.test(String(term))).map(Number);
      assert.equal(letters.length, numbers.length);
      const offsets = letters.map((letter, index) => numbers[index] - letter);
      assert.equal(new Set(offsets).size, 1, 'C7 must keep one number-minus-letter offset');
      assert.notEqual(offsets[0], 0);
      assert.equal(offsets[0], item.params.offset);
    }
    answersAcrossSeeds.add(item.shownTerms.join(',') + '->' + item.answer);
  }
  assert.ok(answersAcrossSeeds.size > 10, family + ' should vary across seeds');
}

for (const level of engine.levels) {
  const spec = engine.generate(level, 911, 'assessment');
  const practice = engine.generate(level, 911, 'practice');
  assert.equal(spec.items.length, 8);
  assert.equal(practice.items.length, 2);
  assert.equal(spec.mode, 'assessment');
  assert.equal(practice.mode, 'practice');
  assert.equal(spec.items.filter(item => !item.solvable).length, level.underdetermined);
  assert.equal(new Set(spec.items.map(signature)).size, spec.items.length);
  assert.equal(new Set(practice.items.map(signature)).size, practice.items.length);
  assert.equal(new Set(spec.items.concat(practice.items).map(signature)).size, 10);
  assert.equal(new Set(spec.items.concat(practice.items).map(item => item.rule)).size, 10);
  for (const item of spec.items.concat(practice.items)) {
    checkBounds(item);
    if (item.solvable) {
      const predictions = Array.from(engine.consistentAnswers(item.shownTerms));
      assert.equal(predictions.length, 1);
      assert.equal(predictions[0], String(item.answer));
    } else {
      assert.ok(engine.consistentAnswers(item.shownTerms).length >= 2);
    }
  }
  const familyRank = item => {
    const family = item.solvable ? item.family : item.sourceFamily;
    return ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'].indexOf(family);
  };
  const ranks = spec.items.map(familyRank);
  assert.deepEqual(ranks, ranks.slice().sort((left, right) => left - right));
  assert.equal(JSON.stringify(engine.generate(level, 911, 'assessment')), JSON.stringify(spec));
}

const variationOne = JSON.stringify(engine.generate(7, 42, 'assessment'));
const variationTwo = JSON.stringify(engine.generate(7, 43, 'assessment'));
assert.notEqual(variationOne, variationTwo);
assert.equal(engine.consistentAnswers([2, 4]).length >= 2, true);

const ordinary = engine.generate(1, 2026, 'assessment');
const allCorrect = ordinary.items.map((item, index) => ({answer: item.answer, rtMs: 200 + index * 10}));
const correctMetrics = engine.score(1, ordinary, allCorrect);
assert.equal(correctMetrics.correctCount, 8);
assert.equal(correctMetrics.timeouts, 0);
assert.equal(correctMetrics.medianRt, 235);
assert.equal(correctMetrics.falseDeclines, 0);
assert.equal(correctMetrics.falseAnswers, 0);

const allTimeoutMetrics = engine.score(1, ordinary, new Array(8).fill(null));
assert.equal(allTimeoutMetrics.correctCount, 0);
assert.equal(allTimeoutMetrics.timeouts, 8);
assert.equal(engine.validate(allTimeoutMetrics, 1).valid, false);
assert.ok(engine.validate(allTimeoutMetrics, 1).flags.includes('all_timeouts'));

const levelTen = engine.generate(10, 123, 'assessment');
const allDeclines = engine.score(10, levelTen, new Array(8).fill({type: 'cnd'}));
assert.equal(allDeclines.correctCount, 4);
assert.equal(allDeclines.falseDeclines, 4);
assert.equal(allDeclines.falseAnswers, 0);
assert.equal(allDeclines.cannotDetermineCount, 8);
assert.equal(engine.validate(allDeclines, 10).valid, true);
assert.ok(engine.validate(allDeclines, 10).flags.includes('all_cannot_determine'));

const mixedSpec = engine.generate(5, 818, 'assessment');
const mixedResponses = mixedSpec.items.map((item, index) => {
  if (index === 0) return {answer: item.answer, rtMs: 345};
  if (index === 1) return null;
  if (!item.solvable) return {answer: '123', rtMs: 600};
  return {answer: 'wrong', rtMs: 700};
});
const mixed = engine.score(5, mixedSpec, mixedResponses);
assert.equal(mixed.correctCount, 1);
assert.equal(mixed.timeouts, 1);
assert.equal(mixed.falseAnswers, 1);
assert.equal(mixed.medianRt, 345);
assert.ok(engine.validate({...mixed, timeouts: 4}, 5).flags.includes('too_many_timeouts'));
assert.ok(engine.validate(mixed, 5, {hiddenMidItem: true}).flags.includes('hidden'));

assert.equal(engine.statusOf(4.99), 'Not yet');
assert.equal(engine.statusOf(5), 'Developing');
assert.equal(engine.statusOf(6.99), 'Developing');
assert.equal(engine.statusOf(7), 'Mastered');
assert.equal(engine.statusPolicy([]).status, 'Unassessed');
function block(correctCount, ts, overrides) {
  return {correctCount, ts, valid: true, mode: 'assessment', ...overrides};
}
assert.equal(engine.statusPolicy([block(4, '2026-01-01')]).status, 'Not yet');
assert.equal(engine.statusPolicy([block(5, '2026-01-01')]).status, 'Developing');
assert.equal(engine.statusPolicy([block(7, '2026-01-01')]).status, 'Mastered');
const rolling = engine.statusPolicy([
  block(0, '2026-01-01'),
  block(5, '2026-01-02'),
  block(7, '2026-01-03'),
  block(8, '2026-01-04'),
  block(8, '2026-01-05', {valid: false}),
  block(8, '2026-01-06', {mode: 'practice'})
]);
assert.equal(rolling.n, 4);
assert.equal(rolling.meanCorrect, 20 / 3);
assert.equal(rolling.meanValue, rolling.meanCorrect);
assert.equal(rolling.status, 'Developing');
const nestedMetrics = engine.statusPolicy([
  {metrics: {correctCount: 6}, ts: '2026-02-01', valid: true, mode: 'assessment'},
  {metrics: {correctCount: 7}, ts: '2026-02-02', valid: true, mode: 'assessment'}
]);
assert.equal(nestedMetrics.first, 6);
assert.equal(nestedMetrics.latest, 7);
assert.equal(nestedMetrics.meanValue, 6.5);

assert.match(engine.levelSummary(10), /false declines and false answers/);
assert.match(engine.ruleText(10), /self-monitoring/);
assert.equal(engine.nameOf(10), 'Number and Letter Series — Level 10');

console.log('Series engine tests passed (10,000 seeds per family).');
