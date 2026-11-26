(function () {
  const config = window.HCCTSeriesConfig;
  const common = window.HCCTTaskEngineCommon;
  const patterns = window.HCCTSeriesPatterns;
  if (!config || !common || !patterns) throw new Error('Series config, patterns, and task-engine-common must be loaded before series-generation.');
  const {PRACTICE, SCORED, RETRY_LIMIT, FAMILY_ORDER, LEVELS} = config;
  const {integer, choose, asTerm, consistentAnswers, FAMILY_CHECKERS, figurate} = patterns;

  function numberSequence(random, count, startMin, startMax, stepMin, stepMax, step) {
    const first = integer(random, startMin, startMax);
    const delta = step === undefined ? integer(random, stepMin, stepMax) : step;
    return {terms: Array.from({length: count}, (_, index) => first + delta * index), params: {start: first, step: delta}};
  }

  function progression(random, count, options) {
    const kind = options && options.kind ? options.kind : 'number';
    const stepMin = options && options.stepMin !== undefined ? options.stepMin : 1;
    const stepMax = options && options.stepMax !== undefined ? options.stepMax : 9;
    const magnitude = integer(random, stepMin, stepMax);
    const step = magnitude * (options && options.direction ? options.direction : 1);
    if (kind === 'letter') {
      const minimum = step < 0 ? 1 + magnitude * (count - 1) : 1;
      const maximum = step > 0 ? 26 - magnitude * (count - 1) : 26;
      const start = integer(random, Math.max(1, minimum), Math.max(1, maximum));
      return {terms: Array.from({length: count}, (_, index) => String.fromCharCode(64 + start + step * index)), params: {kind, start, step}};
    }
    const sequence = numberSequence(random, count, -300, 300, stepMin, stepMax, step);
    return {terms: sequence.terms, params: {kind, ...sequence.params}};
  }

  function rawCandidate(family, random, shownCount, options) {
    const total = shownCount + 1;
    let terms;
    let params;
    if (family === 'C1') {
      const kind = choose(options && options.letterOnly ? ['letter'] : ['number', 'letter'], random);
      const minimum = options && options.minStep !== undefined ? options.minStep : 1;
      const stepMax = 9;
      const direction = options && options.positiveOnly ? 1 : choose([-1, 1], random);
      const sequence = progression(random, total, {kind, stepMin: minimum, stepMax, direction});
      terms = sequence.terms;
      params = sequence.params;
    } else if (family === 'C2') {
      const multiplier = choose([2, 3], random);
      const start = integer(random, -10, 10) || 1;
      terms = Array.from({length: total}, (_, index) => start * Math.pow(multiplier, index));
      params = {start, multiplier};
    } else if (family === 'C3') {
      const secondStep = choose([-2, -1, 1, 2], random);
      const start = integer(random, -50, 50);
      let step = integer(random, -15, 15);
      if (!step) step = 1;
      terms = [start];
      for (let index = 1; index < total; index++) {
        terms.push(terms[index - 1] + step);
        step += secondStep;
      }
      params = {start, firstStep: terms[1] - terms[0], secondStep};
    } else if (family === 'C4') {
      const firstMode = choose(['linear', 'multiply'], random);
      const secondMode = choose(['linear', 'multiply'], random);
      const first = firstMode === 'multiply'
        ? {start: integer(random, -8, 8) || 1, multiplier: choose([2, 3], random)}
        : {start: integer(random, -30, 30), step: integer(random, -9, 9) || 1};
      const second = secondMode === 'multiply'
        ? {start: integer(random, -8, 8) || 1, multiplier: choose([2, 3], random)}
        : {start: integer(random, -30, 30), step: integer(random, -9, 9) || 1};
      if (firstMode === secondMode) {
        if (firstMode === 'multiply' && second.multiplier === first.multiplier) {
          second.multiplier = first.multiplier === 2 ? 3 : 2;
        } else if (firstMode === 'linear' && second.step === first.step) {
          const alternatives = [];
          for (let step = -9; step <= 9; step++) {
            if (step && step !== first.step) alternatives.push(step);
          }
          second.step = choose(alternatives, random);
        }
      }
      const series = [first, second];
      terms = Array.from({length: total}, (_, index) => {
        const position = Math.floor(index / 2);
        const rule = series[index % 2];
        return rule.multiplier ? rule.start * Math.pow(rule.multiplier, position) : rule.start + rule.step * position;
      });
      params = {odd: series[0], even: series[1]};
    } else if (family === 'C5') {
      const recurrence = choose(['sum', 'double-difference'], random);
      let first = integer(random, -18, 18);
      let second = integer(random, -18, 18);
      if (!first && !second) second = 1;
      terms = [first, second];
      while (terms.length < total) {
        const last = terms[terms.length - 1];
        const before = terms[terms.length - 2];
        terms.push(recurrence === 'sum' ? last + before : 2 * last - before);
      }
      params = {first, second, recurrence};
    } else if (family === 'C6') {
      const step = integer(random, -8, 8) || 1;
      const multiplier = choose([2, 3], random);
      terms = [integer(random, -10, 10)];
      while (terms.length < total) {
        const index = terms.length - 1;
        terms.push(index % 2 === 0 ? terms[index] + step : terms[index] * multiplier);
      }
      params = {start: terms[0], step, multiplier};
    } else if (family === 'C7') {
      const letterParity = choose([0, 1], random);
      const letterCount = letterParity === 0 ? Math.ceil(total / 2) : Math.floor(total / 2);
      const letterStep = integer(random, 1, 5);
      const letterStart = integer(random, 1, Math.max(1, 27 - letterStep * (letterCount - 1)));
      const offset = integer(random, -20, 20) || 1;
      terms = Array.from({length: total}, (_, index) => index % 2 === letterParity
        ? String.fromCharCode(64 + letterStart + letterStep * Math.floor(index / 2))
        : letterStart + offset + letterStep * Math.floor(index / 2));
      params = {letterParity, letterStart, letterStep, offset};
    } else if (family === 'C8') {
      const kind = choose(['square', 'cube', 'triangular'], random);
      const start = integer(random, 1, 4);
      const offset = integer(random, -20, 20);
      terms = Array.from({length: total}, (_, index) => figurate(kind, start + index) + offset);
      params = {kind, start, offset};
    } else if (family === 'C9') {
      const variant = choose(['third-difference', 'nested-cycle'], random);
      if (variant === 'third-difference') {
        const thirdStep = choose([-2, -1, 1, 2], random);
        terms = [integer(random, -25, 25), integer(random, -10, 10), integer(random, -10, 10)];
        while (terms.length < total) {
          const last = terms.length - 1;
          const priorDifference = terms[last] - terms[last - 1];
          const priorSecond = priorDifference - (terms[last - 1] - terms[last - 2]);
          terms.push(terms[last] + priorDifference + priorSecond + thirdStep);
        }
        params = {variant, first: terms[0], second: terms[1], third: terms[2], thirdStep};
      } else {
        const addFirst = integer(random, -7, 7) || 1;
        let addThird = integer(random, -7, 7) || -1;
        if (addThird === addFirst) addThird = addFirst === 7 ? -7 : addFirst + 1;
        const multiplier = choose([2, 3], random);
        terms = [integer(random, -8, 8)];
        while (terms.length < total) {
          const index = terms.length - 1;
          terms.push(index % 3 === 0 ? terms[index] + addFirst
            : index % 3 === 1 ? terms[index] * multiplier
              : terms[index] + addThird);
        }
        params = {variant, start: terms[0], addFirst, addThird, multiplier};
      }
    } else {
      throw new Error('Unknown series family: ' + family);
    }

    return {terms, params, rule: family + ':' + JSON.stringify(params)};
  }

  function uniqueCandidate(family, random, shownCount, options) {
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
      const raw = rawCandidate(family, random, shownCount, options);
      const shownTerms = raw.terms.slice(0, -1);
      const answer = String(raw.terms[raw.terms.length - 1]);
      if (raw.terms.some(term => {
        const parsed = asTerm(term);
        return !parsed;
      })) continue;
      const predictions = consistentAnswers(shownTerms);
      if (predictions.length === 1 && predictions[0] === answer) {
        return {family, shownTerms, answer, solvable: true, rule: raw.rule, params: raw.params};
      }
    }
    throw new Error('Series generator exhausted ' + RETRY_LIMIT + ' retries for ' + family + '.');
  }

  function generateFamily(family, seed, termCount, options) {
    if (!FAMILY_CHECKERS[family]) throw new Error('Unknown series family: ' + family);
    const random = common.rng(seed);
    return uniqueCandidate(family, random, termCount, options);
  }

  function levelFor(level) {
    const id = typeof level === 'number' ? level : level && level.id;
    const match = LEVELS.find(candidate => candidate.id === id);
    if (!match) throw new Error('Unknown series level: ' + id);
    return match;
  }

  function familyConfig(level) {
    let families;
    if (level.id === 7) families = ['C6', 'C6', 'C6', 'C6', 'C7', 'C7', 'C7'];
    else if (level.id === 10) families = ['C6', 'C6', 'C7', 'C9'];
    else families = new Array(SCORED - level.underdetermined).fill(level.families[0]);
    const configs = families.map(family => ({family, underdetermined: false}));
    for (let index = 0; index < level.underdetermined; index++) {
      const sourceFamily = level.id === 10 ? 'C9' : level.families[level.families.length - 1];
      configs.push({family: sourceFamily, underdetermined: true});
    }
    return configs.map((config, index) => ({...config, index}))
      .sort((left, right) => FAMILY_ORDER.indexOf(left.family) - FAMILY_ORDER.indexOf(right.family) || left.index - right.index);
  }

  function makeUnderdetermined(random, sourceFamily, termCount) {
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
      const start = integer(random, 2, 9);
      const shownTerms = [start, start * 2];
      const answers = consistentAnswers(shownTerms);
      if (answers.length >= 2) {
        return {
          family: 'underdetermined',
          sourceFamily,
          shownTerms,
          answer: null,
          solvable: false,
          rule: 'underdetermined:' + sourceFamily + ':' + JSON.stringify(shownTerms),
          params: {truncatedFamily: 'C2', start, multiplier: 2}
        };
      }
    }
    throw new Error('Underdetermined generator exhausted ' + RETRY_LIMIT + ' retries for ' + sourceFamily + '.');
  }

  function itemSignature(item) {
    return item.shownTerms.map(String).join(',');
  }

  function makeItem(config, level, random, usedRules, usedSeries, index) {
    const range = Array.isArray(level.terms) ? level.terms : [level.terms, level.terms];
    const termsShown = config.family === 'C9' && !config.underdetermined
      ? range[1]
      : integer(random, range[0], range[1]);
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
      const item = config.underdetermined
        ? makeUnderdetermined(random, config.family, termsShown)
        : uniqueCandidate(config.family, random, termsShown, level.id === 1
          ? {positiveOnly: true}
          : level.id === 2 ? {minStep: 2} : null);
      const signature = itemSignature(item);
      if (usedRules.has(item.rule) || usedSeries.has(signature)) continue;
      usedRules.add(item.rule);
      usedSeries.add(signature);
      item.id = 'item-' + index;
      item.timeSeconds = level.timeSeconds;
      item.termCount = item.shownTerms.length;
      item.prompt = item.shownTerms.join(', ') + ', ?';
      return item;
    }
    throw new Error('Series block exhausted retries while avoiding duplicate items at level ' + level.id + '.');
  }

  function generate(level, seed, mode) {
    const selected = levelFor(level);
    const random = common.rng(seed);
    const usedRules = new Set();
    const usedSeries = new Set();
    const configs = familyConfig(selected);
    const scoredItems = configs.map((config, index) =>
      makeItem(config, selected, random, usedRules, usedSeries, index));
    const practiceFamily = selected.families[0];
    const practiceItems = [];
    for (let index = 0; index < PRACTICE; index++) {
      practiceItems.push(makeItem({family: practiceFamily, underdetermined: false}, selected, random,
        usedRules, usedSeries, 'practice-' + index));
    }
    const selectedMode = mode === 'practice' ? 'practice' : 'assessment';
    const items = selectedMode === 'practice' ? practiceItems : scoredItems;
    return {
      levelId: selected.id,
      seed,
      mode: selectedMode,
      itemCount: items.length,
      items
    };
  }

  window.HCCTSeriesGeneration = Object.freeze({generate, generateFamily, levelFor});
})();
