(function () {
  const config = window.HCCTFlankerConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('Flanker config and task-engine-common must be loaded before flanker-generation.');
  const MASK_LETTERS = config.MASK_LETTERS;
  const TARGETS_BY_KEY = config.TARGETS_BY_KEY;
  const SCORED = config.SCORED;
  const PRACTICE = config.PRACTICE;

  function pickTarget(key, previousTarget, targetRun, random) {
    const choices = TARGETS_BY_KEY[key];
    if (targetRun >= 3 && previousTarget && choices.length === 1) return choices[0];
    if (targetRun >= 3 && previousTarget && choices.includes(previousTarget)) {
      return choices[1 - choices.indexOf(previousTarget)];
    }
    return choices[Math.floor(random() * choices.length)];
  }

  function makeTrials(level, types, scored, random) {
    const slots = [];
    const counts = types.reduce((result, type) => {
      result[type] = (result[type] || 0) + 1;
      return result;
    }, {});
    for (const [type, count] of Object.entries(counts)) {
      const perKey = count / 2;
      for (let index = 0; index < perKey; index++) slots.push({type, correctKey: 'F'});
      for (let index = 0; index < perKey; index++) slots.push({type, correctKey: 'J'});
    }
    common.shuffle(slots, random);

    const trials = [];
    let previousTarget = null;
    let targetRun = 0;
    for (const slot of slots) {
      const target = pickTarget(slot.correctKey, previousTarget, targetRun, random);
      if (target === previousTarget) targetRun++;
      else {
        previousTarget = target;
        targetRun = 1;
      }

      const chars = Array(level.stringLength);
      const center = Math.floor(level.stringLength / 2);
      chars[center] = target;
      if (slot.type === 'congruent') {
        chars.fill(target);
      } else if (slot.type === 'incongruent') {
        const opposite = TARGETS_BY_KEY[slot.correctKey === 'F' ? 'J' : 'F'];
        for (let index = 0; index < chars.length; index++) {
          if (index !== center) chars[index] = opposite[Math.floor(random() * opposite.length)];
        }
      } else if (slot.type === 'neutral') {
        for (let index = 0; index < chars.length; index++) {
          if (index !== center) chars[index] = 'X';
        }
      }

      const mask = level.maskMs
        ? Array.from({length: level.stringLength}, () => MASK_LETTERS[Math.floor(random() * MASK_LETTERS.length)]).join('')
        : null;
      trials.push({
        string: chars.join(''),
        target,
        correctKey: slot.correctKey,
        type: slot.type,
        jitterMs: 400 + Math.floor(random() * 301),
        exposureMs: level.exposureMs,
        exposureIsFrame: !!level.exposureIsFrame,
        mask,
        maskMs: level.maskMs,
        responseWindowMs: level.responseWindowMs,
        scored,
        practice: !scored
      });
    }
    return trials;
  }

  function trialTypes(level, count) {
    if (level.id === 1) return Array(count).fill('single');
    if (level.id === 2) return Array(count).fill('neutral');
    const half = count / 2;
    return Array(half).fill('congruent').concat(Array(half).fill('incongruent'));
  }

  function generate(level, seed, mode) {
    const random = common.rng(seed);
    if (mode === 'practice') {
      const trials = makeTrials(level, trialTypes(level, PRACTICE), false, random);
      return {
        levelId: level.id,
        mode: 'practice',
        N: PRACTICE,
        scoredCount: 0,
        practiceCount: PRACTICE,
        trials
      };
    }
    const trials = makeTrials(level, trialTypes(level, SCORED), true, random);
    return {
      levelId: level.id,
      mode: 'assessment',
      N: trials.length,
      scoredCount: SCORED,
      practiceCount: 0,
      trials
    };
  }

  window.HCCTFlankerGeneration = Object.freeze({generate});
})();
