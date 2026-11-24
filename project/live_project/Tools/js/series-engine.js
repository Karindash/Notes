(function () {
  const common = window.HCCTTaskEngineCommon;
  if (!common) throw new Error('HCCTTaskEngineCommon must be loaded before HCCTSeriesEngine.');

  const LIMIT = 9999;
  const PRACTICE = 2;
  const SCORED = 8;
  const RETRY_LIMIT = 2000;
  const FAMILY_ORDER = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const LEVELS = [
    {id: 1, tier: 'Easy', families: ['C1'], terms: 5, timeSeconds: 20, underdetermined: 0},
    {id: 2, tier: 'Easy', families: ['C1'], terms: 5, timeSeconds: 20, underdetermined: 0},
    {id: 3, tier: 'Moderate', families: ['C2'], terms: 5, timeSeconds: 20, underdetermined: 0},
    {id: 4, tier: 'Moderate', families: ['C3'], terms: 6, timeSeconds: 30, underdetermined: 0},
    {id: 5, tier: 'Hard', families: ['C4'], terms: 7, timeSeconds: 30, underdetermined: 1},
    {id: 6, tier: 'Hard', families: ['C5'], terms: 6, timeSeconds: 30, underdetermined: 1},
    {id: 7, tier: 'Very hard', families: ['C6', 'C7'], terms: 7, timeSeconds: 45, underdetermined: 1},
    {id: 8, tier: 'Very hard', families: ['C8'], terms: 6, timeSeconds: 45, underdetermined: 1},
    {id: 9, tier: 'Extreme', families: ['C9'], terms: 7, timeSeconds: 45, underdetermined: 1},
    {id: 10, tier: 'Impossible', families: ['C6', 'C7', 'C9'], terms: [5, 7], timeSeconds: 45, underdetermined: 4}
  ].map(level => Object.freeze({
    ...level,
    family: level.families.join(', '),
    itemCount: SCORED,
    practiceCount: PRACTICE,
    ms: level.timeSeconds * 1000,
    timeLimitMs: level.timeSeconds * 1000
  }));
  Object.freeze(LEVELS);

  const meta = Object.freeze({
    id: 'series',
    name: 'Number and Letter Series',
    groups: ['Reasoning', 'Information processing'],
    construct: 'Inductive reasoning: finding a rule in a sequence and applying it.',
    procedure: 'Type the missing next term, or choose “Can’t be determined” when the shown terms do not identify a unique answer.',
    stimuli: 'Integer and A–Z series; letters never wrap past Z.',
    primaryMetric: 'Correct answers (out of 8)',
    difficultyAxis: 'Series level',
    confounds: ['Arithmetic fluency and prior exposure to number series', 'Typing speed affects response time, not accuracy'],
    validityRules: ['All timeouts or a hidden tab mid-item: block is invalid.', 'More than 3 timeouts or all “Can’t be determined” responses: warning.']
  });

  const links = Object.freeze([
    {capability: 'Reasoning › Inductive reasoning', weight: '0.8', kind: 'primary', note: 'Infer a rule from observed terms and apply it to the missing term.'},
    {capability: 'Information processing › Abstraction', weight: '0.5', kind: 'primary', note: 'Represent a sequence with a compact rule.'},
    {capability: 'Memory › Working memory', weight: '0.4', kind: 'secondary', note: 'Keep several terms available while comparing their relationships.'},
    {capability: 'Metacognition › Self monitoring', weight: '0.3', kind: 'secondary', note: 'Recognize when the available terms do not determine one answer.'},
    {capability: 'Arithmetic fluency and prior exposure to number series', weight: 'n/a', kind: 'confound', note: 'Familiarity can affect performance independently of inductive reasoning.'},
    {capability: 'Typing speed', weight: 'n/a', kind: 'confound', note: 'Typing speed affects response time, not accuracy.'}
  ].map(Object.freeze));

  const profile = Object.freeze({
    metricKey: 'correctCount',
    metricName: 'Items correct',
    unit: 'items',
    axis: {
      min: 0,
      max: 8,
      ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      referenceLines: [{value: 5, label: 'developing ≥ 5'}, {value: 7, label: 'mastered ≥ 7'}]
    },
    detailMetrics: ['falseDeclines', 'falseAnswers']
  });

  const ui = Object.freeze({start: null, handleInput: null, finish: null});

  function integer(random, min, max) {
    return min + Math.floor(random() * (max - min + 1));
  }

  function choose(values, random) {
    return common.shuffle(values.slice(), random)[0];
  }

  function asTerm(value) {
    if (typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= LIMIT) {
      return {kind: 'number', value};
    }
    if (typeof value === 'string') {
      const text = value.trim().toUpperCase();
      if (/^[A-Z]$/.test(text)) return {kind: 'letter', value: text.charCodeAt(0) - 64};
      if (/^[+-]?\d+$/.test(text)) {
        const number = Number(text);
        if (Number.isSafeInteger(number) && Math.abs(number) <= LIMIT) return {kind: 'number', value: number};
      }
    }
    return null;
  }

  function formatTerm(kind, value) {
    if (!Number.isInteger(value) || Math.abs(value) > LIMIT) return null;
    if (kind === 'letter') return value >= 1 && value <= 26 ? String.fromCharCode(64 + value) : null;
    return String(value);
  }

  function converted(terms) {
    if (!Array.isArray(terms) || !terms.length) return null;
    const result = terms.map(asTerm);
    if (result.some(term => !term)) return null;
    return result;
  }

  function equalTerms(values, expected) {
    return values.every((value, index) => value === expected[index]);
  }

  function simplePredictions(values) {
    if (values.length < 2) return [];
    if (values.some(term => term.kind !== values[0].kind)) return [];
    const out = [];
    const kind = values[0].kind;
    const numbers = values.map(term => term.value);
    const differences = numbers.slice(1).map((value, index) => value - numbers[index]);
    if (differences[0] !== 0 && Math.abs(differences[0]) <= 9 && differences.every(value => value === differences[0])) {
      const prediction = formatTerm(kind, numbers[numbers.length - 1] + differences[0]);
      if (prediction !== null) out.push(prediction);
    }
    if (kind === 'number' && numbers[0] !== 0) {
      [2, 3].forEach(multiplier => {
        if (numbers.slice(1).every((value, index) => value === numbers[index] * multiplier)) {
          const prediction = formatTerm(kind, numbers[numbers.length - 1] * multiplier);
          if (prediction !== null) out.push(prediction);
        }
      });
    }
    return out;
  }

  function checkC1(values) {
    if (values.length < 2) return [];
    return simplePredictions(values);
  }

  function checkC2(values) {
    if (values.length < 2 || values[0].kind !== 'number') return [];
    const numbers = values.map(term => term.value);
    return [2, 3].filter(multiplier =>
      numbers[0] !== 0 && numbers.slice(1).every((term, position) => term === numbers[position] * multiplier)
    ).map(multiplier => String(numbers[numbers.length - 1] * multiplier));
  }

  function checkC3(values) {
    if (values.length < 4 || values.some(term => term.kind !== 'number')) return [];
    const numbers = values.map(term => term.value);
    const first = numbers.slice(1).map((value, index) => value - numbers[index]);
    const second = first.slice(1).map((value, index) => value - first[index]);
    if (!second.length || ![1, 2, -1, -2].includes(second[0]) || !second.every(value => value === second[0])) return [];
    const answer = formatTerm('number', numbers[numbers.length - 1] + first[first.length - 1] + second[0]);
    return answer === null ? [] : [answer];
  }

  function checkC4(values) {
    if (values.length < 4) return [];
    const sequences = [0, 1].map(parity => values.filter((term, index) => index % 2 === parity));
    if (sequences.some(sequence => sequence.length < 2 || !simplePredictions(sequence).length)) return [];
    return simplePredictions(sequences[values.length % 2]);
  }

  function checkC5(values) {
    if (values.length < 4 || values.some(term => term.kind !== 'number')) return [];
    const numbers = values.map(term => term.value);
    const predictions = [];
    const rules = [
      {matches: (index) => numbers[index] === numbers[index - 1] + numbers[index - 2], next: numbers[numbers.length - 1] + numbers[numbers.length - 2]},
      {matches: (index) => numbers[index] === 2 * numbers[index - 1] - numbers[index - 2], next: 2 * numbers[numbers.length - 1] - numbers[numbers.length - 2]}
    ];
    rules.forEach(rule => {
      let fits = true;
      for (let index = 2; index < numbers.length; index++) {
        if (!rule.matches(index)) fits = false;
      }
      const answer = formatTerm('number', rule.next);
      if (fits && answer !== null) predictions.push(answer);
    });
    return predictions;
  }

  function checkC6(values) {
    if (values.length < 4 || values.some(term => term.kind !== 'number')) return [];
    const numbers = values.map(term => term.value);
    const predictions = [];
    for (let step = -9; step <= 9; step++) {
      if (!step) continue;
      [2, 3].forEach(multiplier => {
        const fits = numbers.slice(1).every((value, index) =>
          value === (index % 2 === 0 ? numbers[index] + step : numbers[index] * multiplier)
        );
        if (fits) {
          const lastIndex = numbers.length - 1;
          const answer = formatTerm('number', lastIndex % 2 === 0
            ? numbers[lastIndex] + step
            : numbers[lastIndex] * multiplier);
          if (answer !== null) predictions.push(answer);
        }
      });
    }
    return predictions;
  }

  function checkC7(values) {
    if (values.length < 4) return [];
    const predictions = [];
    [0, 1].forEach(letterParity => {
      const letters = values.filter((term, index) => index % 2 === letterParity);
      const numbers = values.filter((term, index) => index % 2 !== letterParity);
      if (letters.length < 2 || numbers.length < 2 ||
          letters.some(term => term.kind !== 'letter') ||
          numbers.some(term => term.kind !== 'number')) return;
      const pairedCount = Math.min(letters.length, numbers.length);
      const offset = numbers[0].value - letters[0].value;
      if (offset === 0 || !Array.from({length: pairedCount}, (_, index) =>
        numbers[index].value - letters[index].value
      ).every(value => value === offset)) return;
      const nextIsLetter = values.length % 2 === letterParity;
      const nextSequence = nextIsLetter ? letters : numbers;
      const fitted = simplePredictions(nextSequence);
      const pairedPrediction = nextIsLetter
        ? (numbers.length > letters.length ? numbers[numbers.length - 1].value - offset : null)
        : (letters.length > numbers.length ? letters[letters.length - 1].value + offset : null);
      predictions.push(...fitted.filter(answer =>
        pairedPrediction === null || Number(answer) === pairedPrediction ||
          (nextIsLetter && answer === String.fromCharCode(64 + pairedPrediction))
      ));
    });
    return predictions;
  }

  function figurate(kind, index) {
    if (kind === 'square') return index * index;
    if (kind === 'cube') return index * index * index;
    return index * (index + 1) / 2;
  }

  function checkC8(values) {
    if (values.length < 4 || values.some(term => term.kind !== 'number')) return [];
    const numbers = values.map(term => term.value);
    const predictions = [];
    ['square', 'cube', 'triangular'].forEach(kind => {
      for (let start = 1; start <= 100; start++) {
        const offset = numbers[0] - figurate(kind, start);
        if (numbers.every((value, index) => value === figurate(kind, start + index) + offset)) {
          const answer = formatTerm('number', figurate(kind, start + numbers.length) + offset);
          if (answer !== null) predictions.push(answer);
        }
      }
    });
    return predictions;
  }

  function checkC9(values) {
    if (values.length < 6 || values.some(term => term.kind !== 'number')) return [];
    const numbers = values.map(term => term.value);
    const predictions = [];
    let first = numbers.slice(1).map((value, index) => value - numbers[index]);
    let second = first.slice(1).map((value, index) => value - first[index]);
    const third = second.slice(1).map((value, index) => value - second[index]);
    if (third.length >= 2 && Math.abs(third[0]) <= 4 && third[0] !== 0 && third.every(value => value === third[0])) {
      const answer = formatTerm('number', numbers[numbers.length - 1] + first[first.length - 1] + second[second.length - 1] + third[0]);
      if (answer !== null) predictions.push(answer);
    }
    if (values.length >= 7) {
      for (let addFirst = -9; addFirst <= 9; addFirst++) {
        if (!addFirst) continue;
        for (let addThird = -9; addThird <= 9; addThird++) {
          if (!addThird || addFirst === addThird) continue;
          [2, 3].forEach(multiplier => {
            const fits = numbers.slice(1).every((value, index) => {
              const prior = numbers[index];
              if (index % 3 === 0) return value === prior + addFirst;
              if (index % 3 === 1) return value === prior * multiplier;
              return value === prior + addThird;
            });
            if (fits) {
              const operation = numbers.length - 1;
              const last = numbers[numbers.length - 1];
              const answer = formatTerm('number', operation % 3 === 0
                ? last + addFirst
                : operation % 3 === 1 ? last * multiplier : last + addThird);
              if (answer !== null) predictions.push(answer);
            }
          });
        }
      }
    }
    return predictions;
  }

  const FAMILY_CHECKERS = Object.freeze({
    C1: checkC1, C2: checkC2, C3: checkC3, C4: checkC4, C5: checkC5,
    C6: checkC6, C7: checkC7, C8: checkC8, C9: checkC9
  });

  function consistentAnswers(shownTerms) {
    const values = converted(shownTerms);
    if (!values) return [];
    const answers = new Set();
    FAMILY_ORDER.forEach(family => FAMILY_CHECKERS[family](values).forEach(answer => answers.add(answer)));
    return Array.from(answers);
  }

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

  function normalizeAnswer(value) {
    if (typeof value === 'number' && Number.isInteger(value)) return String(value);
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (/^[A-Za-z]$/.test(text)) return text.toUpperCase();
    if (/^[+-]?\d+$/.test(text)) return String(Number(text));
    return null;
  }

  function responseKind(response) {
    if (response === null || response === undefined) return {kind: 'timeout'};
    if (typeof response === 'string') {
      const text = response.trim().toLowerCase();
      if (text === 'cnd' || text === "can't be determined" || text === 'cannot be determined') return {kind: 'cnd'};
      return {kind: 'typed', answer: normalizeAnswer(response)};
    }
    if (typeof response !== 'object') return {kind: 'typed', answer: normalizeAnswer(response)};
    if (response.timeout === true || response.timedOut === true) return {kind: 'timeout'};
    if (response.cannotDetermine === true || response.type === 'cnd' || response.type === 'cannotDetermine') return {kind: 'cnd'};
    const answer = response.answer !== undefined ? response.answer : response.value;
    if (typeof answer === 'string' && /^(cnd|can't be determined|cannot be determined)$/i.test(answer.trim())) return {kind: 'cnd'};
    return answer === undefined || answer === null
      ? {kind: 'timeout'}
      : {kind: 'typed', answer: normalizeAnswer(answer), rtMs: response.rtMs !== undefined ? response.rtMs : response.rt};
  }

  function score(level, spec, responses) {
    levelFor(level);
    const items = spec && Array.isArray(spec.items) ? spec.items : [];
    const answers = Array.isArray(responses) ? responses : [];
    const responseTimes = [];
    let correctCount = 0;
    let timeouts = 0;
    let falseDeclines = 0;
    let falseAnswers = 0;
    let cannotDetermineCount = 0;
    const itemResults = items.map((item, index) => {
      const response = responseKind(answers[index]);
      let correct = false;
      if (response.kind === 'timeout') {
        timeouts++;
      } else if (response.kind === 'cnd') {
        cannotDetermineCount++;
        if (!item.solvable) correct = true;
        else falseDeclines++;
      } else if (!item.solvable) {
        falseAnswers++;
      } else if (response.answer !== null && response.answer === normalizeAnswer(item.answer)) {
        correct = true;
      }
      if (correct) {
        correctCount++;
        const rt = response.rtMs;
        if (Number.isFinite(rt) && rt >= 0) responseTimes.push(rt);
      }
      return {index, correct, response: response.kind};
    });
    return {
      correctCount,
      total: items.length,
      accuracy: items.length ? correctCount / items.length : null,
      medianRt: common.median(responseTimes),
      medianRtCorrect: common.median(responseTimes),
      timeouts,
      falseDeclines,
      falseAnswers,
      cannotDetermineCount,
      allCannotDetermine: items.length > 0 && cannotDetermineCount === items.length,
      attempted: items.length - timeouts,
      itemResults
    };
  }

  function validate(metrics, level, timing) {
    levelFor(level);
    const result = metrics || {};
    const flags = [];
    const total = result.total === undefined ? SCORED : result.total;
    const timeouts = result.timeouts || 0;
    let valid = true;
    if (total > 0 && timeouts >= total) {
      valid = false;
      flags.push('all_timeouts');
    }
    if (timing && (timing.hidden === true || timing.hiddenMidItem === true)) {
      valid = false;
      flags.push('hidden');
    }
    if (timeouts > 3) flags.push('too_many_timeouts');
    if (result.allCannotDetermine === true ||
        (total > 0 && result.cannotDetermineCount === total)) flags.push('all_cannot_determine');
    return {valid, flags, warning: flags.some(flag => flag !== 'all_timeouts' && flag !== 'hidden')};
  }

  function statusOf(value) {
    return value >= 7 ? 'Mastered' : value >= 5 ? 'Developing' : 'Not yet';
  }

  function statusPolicy(blocks) {
    const valid = (blocks || []).filter(block => block.valid && block.mode === 'assessment')
      .slice()
      .sort((left, right) => String(left.ts || '').localeCompare(String(right.ts || '')));
    if (!valid.length) return {status: 'Unassessed', n: 0};
    const scored = valid.map(block => {
      const value = block.correctCount !== undefined && block.correctCount !== null
        ? block.correctCount
        : block.metrics && block.metrics.correctCount;
      return {block, value};
    }).filter(entry => Number.isFinite(entry.value));
    if (!scored.length) return {status: 'Unassessed', n: 0};
    const lastThree = scored.slice(-3);
    const meanCorrect = common.mean(lastThree.map(entry => entry.value));
    if (meanCorrect === null) return {status: 'Unassessed', n: 0};
    return {
      status: statusOf(meanCorrect),
      n: scored.length,
      meanCorrect,
      meanValue: meanCorrect,
      first: scored[0].value,
      latest: scored[scored.length - 1].value,
      evidence: common.evidence(scored.length)
    };
  }

  function suggestedLevel(blocks) {
    const history = blocks || [];
    for (const level of LEVELS) {
      const levelBlocks = history.filter(block => block.levelId === level.id);
      if (statusPolicy(levelBlocks).status !== 'Mastered') return level.id;
    }
    return LEVELS[LEVELS.length - 1].id;
  }

  function recommend(level, metrics, valid) {
    const selected = levelFor(level);
    if (!valid) return {text: 'This block cannot be counted as evidence. Try again when the tab is visible and you can complete the items.', next: selected.id};
    const count = metrics.correctCount;
    if (count >= 7) {
      return selected.id < LEVELS.length
        ? {text: 'Strong performance on this rough single-block hint. Next: Level ' + (selected.id + 1) + '.', next: selected.id + 1}
        : {text: 'Level 10 also probes noticing when a problem is underdetermined. Repeat to confirm this rough single-block hint.', next: selected.id};
    }
    if (count >= 5) return {text: 'Developing performance. Repeat this level; a single block is a rough hint.', next: selected.id};
    return {text: selected.id > 1 ? 'Try Level ' + (selected.id - 1) + ' to find a more comfortable level.' : 'Review the instructions and try another Level 1 block.', next: Math.max(1, selected.id - 1)};
  }

  function nameOf(level) {
    const selected = levelFor(level);
    return 'Number and Letter Series — Level ' + selected.id;
  }

  function levelSummary(level) {
    const selected = levelFor(level);
    const terms = Array.isArray(selected.terms) ? selected.terms[0] + '–' + selected.terms[1] : selected.terms;
    const details = selected.id === 10 ? '; includes solvable and underdetermined items, with false declines and false answers shown separately' : '';
    return 'Level ' + selected.id + ' (' + selected.tier + '): ' + selected.families.join(', ') +
      '; ' + terms + ' terms shown; ' + selected.timeSeconds + ' seconds per item; ' +
      selected.underdetermined + ' underdetermined scored item(s)' + details + '.';
  }

  function ruleText(level) {
    const selected = levelFor(level);
    const message = 'Find the simplest rule that fits every shown term, then type the next term. You may instead choose “Can’t be determined” at any level when the terms do not identify one unique next term.';
    return selected.id === 10
      ? message + ' Level 10 also probes noticing when a problem cannot be resolved (self-monitoring), not only reasoning.'
      : message;
  }

  function flagText(flag) {
    if (flag === 'all_timeouts') return 'No items were attempted, so this block is invalid and is not counted as low ability.';
    if (flag === 'hidden') return 'The tab was hidden mid-item. This block is invalid evidence.';
    if (flag === 'too_many_timeouts') return 'More than 3 items timed out; interpret this block cautiously.';
    if (flag === 'all_cannot_determine') return 'Every item was marked “Can’t be determined”; check that the response controls were understood.';
    return flag;
  }

  window.HCCTSeriesEngine = Object.freeze({
    id: 'series',
    name: 'Number and Letter Series',
    policyType: 'capability',
    meta,
    links,
    profile,
    levels: LEVELS,
    ui,
    nameOf,
    levelSummary,
    ruleText,
    generate,
    score,
    validate,
    statusPolicy,
    flagText,
    suggestedLevel,
    statusOf,
    recommend,
    consistentAnswers,
    generateFamily,
    familyCheckers: FAMILY_CHECKERS,
    PRACTICE,
    SCORED,
    LIMIT
  });
})();
