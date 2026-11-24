(function () {
  function rng(seed) {
    let state = seed >>> 0;
    return function () {
      state |= 0;
      state = state + 0x6D2B79F5 | 0;
      let value = Math.imul(state ^ state >>> 15, 1 | state);
      value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, random) {
    for (let index = values.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function quantile(values, probability) {
    if (!values.length) return null;
    const sorted = values.slice().sort((left, right) => left - right);
    const position = (sorted.length - 1) * probability;
    const lower = Math.floor(position);
    const fraction = position - lower;
    return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
  }

  function bootstrapMedianDifference(first, second, seed, repetitions) {
    if (!first.length || !second.length) return null;
    const count = repetitions || 500;
    const random = rng(seed);
    const differences = [];
    for (let iteration = 0; iteration < count; iteration++) {
      const sampleFirst = [];
      const sampleSecond = [];
      for (let index = 0; index < first.length; index++) {
        sampleFirst.push(first[Math.floor(random() * first.length)]);
      }
      for (let index = 0; index < second.length; index++) {
        sampleSecond.push(second[Math.floor(random() * second.length)]);
      }
      differences.push(median(sampleFirst) - median(sampleSecond));
    }
    return {
      estimate: median(first) - median(second),
      lower: quantile(differences, 0.025),
      upper: quantile(differences, 0.975)
    };
  }

  function evidence(count) {
    return count >= 3 ? 'Better' : count === 2 ? 'Moderate' : count === 1 ? 'Low' : '—';
  }

  window.HCCTTaskEngineCommon = Object.freeze({
    rng,
    shuffle,
    mean,
    median,
    bootstrapMedianDifference,
    evidence
  });
})();
