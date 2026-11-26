(function () {
  const config = window.HCCTNBackConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('N-back config and task-engine-common must be loaded before nback-generation.');
  const LETTERS = config.LETTERS;
  const MATCH_P = config.MATCH_P;
  const rng = common.rng;
  const shuffle = common.shuffle;

  // ---- Trial generation ----

  function genStream(level, scoredCount, random, poolSize) {
    const n = level.n;
    const totalLength = n + scoredCount;
    const values = new Array(totalLength);
    const kinds  = new Array(totalLength).fill('W');  // W = warm-up

    const pickExcluding = excluded => {
      let v;
      do { v = Math.floor(random() * poolSize); } while (excluded.includes(v));
      return v;
    };

    const targetCount = Math.round(MATCH_P * scoredCount);

    // Level 0 (target detection): a fixed target letter; scored slots are either T or F.
    if (n === 0) {
      const target = Math.floor(random() * poolSize);
      const targetSet = new Set(shuffle([...Array(totalLength).keys()], random).slice(0, targetCount));
      for (let i = 0; i < totalLength; i++) {
        if (targetSet.has(i)) {
          values[i] = target;
          kinds[i] = 'T';
        } else {
          values[i] = pickExcluding([target]);
          kinds[i] = 'F';
        }
      }
      return { vals: values, kinds, target };
    }

    // Fill warm-up positions randomly.
    for (let i = 0; i < n; i++) values[i] = Math.floor(random() * poolSize);

    const slots = shuffle([...Array(scoredCount).keys()].map(k => k + n), random);
    const lureCount  = Math.round(level.lure * (scoredCount - targetCount));
    const targetSet  = new Set(slots.slice(0, targetCount));
    const lureSet    = new Set(slots.slice(targetCount, targetCount + lureCount));

    for (let i = n; i < totalLength; i++) {
      const nBackValue = values[i - n];

      if (targetSet.has(i)) {
        values[i] = nBackValue;
        kinds[i] = 'T';
        continue;
      }

      if (lureSet.has(i)) {
        // Lure: use n±1 value when available.
        const lureCandidates = [];
        if (i - n - 1 >= 0 && values[i - n - 1] !== nBackValue) lureCandidates.push(values[i - n - 1]);
        if (n >= 2 && values[i - n + 1] !== nBackValue)          lureCandidates.push(values[i - n + 1]);
        if (lureCandidates.length) {
          values[i] = lureCandidates[Math.floor(random() * lureCandidates.length)];
          kinds[i] = 'L';
          continue;
        }
      }

      values[i] = pickExcluding([nBackValue]);
      kinds[i] = 'F';
    }

    return { vals: values, kinds, target: null };
  }

  function genSequence(level, scoredCount, seed) {
    const random = rng(seed);
    const totalLength = level.n + scoredCount;

    const letterStream = genStream(level, scoredCount, random, LETTERS.length);
    const posStream    = level.dual ? genStream(level, scoredCount, random, 8) : null;

    const trials = [];
    for (let i = 0; i < totalLength; i++) {
      trials.push({
        letter: LETTERS[letterStream.vals[i]],
        pos:    posStream ? posStream.vals[i] : null,
      });
    }

    return { n: level.n, N: totalLength, letter: letterStream, pos: posStream, trials };
  }

  // ---- Scoring helpers ----

  function isTarget(seq, trialIndex, channel) {
    const stream = seq[channel];
    if (!stream || trialIndex < seq.n) return null;
    return seq.n === 0
      ? stream.vals[trialIndex] === stream.target
      : stream.vals[trialIndex] === stream.vals[trialIndex - seq.n];
  }

  window.HCCTNBackGeneration = Object.freeze({genSequence, isTarget});
})();
