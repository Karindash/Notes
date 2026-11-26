(function () {
  const config = window.HCCTSeriesConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('Series config and task-engine-common must be loaded before series-patterns.');
  const LIMIT = config.LIMIT;
  const FAMILY_ORDER = config.FAMILY_ORDER;

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

  window.HCCTSeriesPatterns = Object.freeze({integer, choose, asTerm, formatTerm, converted, simplePredictions, FAMILY_CHECKERS, consistentAnswers, figurate});
})();
