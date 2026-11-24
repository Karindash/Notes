(function () {
  const common = window.HCCTTaskEngineCommon;
  if (!common) throw new Error('HCCTTaskEngineCommon must be loaded before HCCTSwitchingEngine.');

  const SCORED = 80;
  const PRACTICE = 16;
  const VOWELS = ['A', 'E', 'I', 'U'];
  const CONSONANTS = ['B', 'D', 'F', 'G', 'K', 'M', 'P', 'R', 'S', 'T'];
  const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9];
  const LEVELS = [
    {id: 1, tier: 'Easy', rules: ['P'], sequence: 'pure', csi: 0, responseWindow: 3000, switchRate: 0},
    {id: 2, tier: 'Easy', rules: ['M'], sequence: 'pure', csi: 0, responseWindow: 3000, switchRate: 0},
    {id: 3, tier: 'Moderate', rules: ['P', 'M'], sequence: 'AABB', csi: 800, responseWindow: 3000, switchRate: 0.5},
    {id: 4, tier: 'Moderate', rules: ['P', 'M'], sequence: 'random', csi: 800, responseWindow: 2500, switchRate: 0.5},
    {id: 5, tier: 'Hard', rules: ['P', 'M'], sequence: 'random', csi: 500, responseWindow: 2000, switchRate: 0.5},
    {id: 6, tier: 'Hard', rules: ['P', 'M'], sequence: 'random', csi: 200, responseWindow: 1800, switchRate: 0.5},
    {id: 7, tier: 'Very hard', rules: ['P', 'M'], sequence: 'random', csi: 0, responseWindow: 1500, switchRate: 0.5},
    {id: 8, tier: 'Very hard', rules: ['P', 'M', 'V'], sequence: 'random', csi: 0, responseWindow: 1500, switchRate: 0.67},
    {id: 9, tier: 'Extreme', rules: ['P', 'M', 'V'], sequence: 'random', csi: 0, responseWindow: 1100, switchRate: 1},
    {id: 10, tier: 'Impossible', rules: ['P', 'M', 'V'], sequence: 'random', csi: 0, cueFlash: 80, responseWindow: 700, switchRate: 1}
  ];

  const meta = {
    id: 'switching',
    name: 'Task switching ladder',
    groups: ['Cognitive flexibility', 'Attention'],
    construct: 'Cognitive flexibility: adapting behavior when the rule changes.',
    procedure: 'Follow the cue rule and press F or J to classify the displayed digit or letter-digit pair.',
    stimuli: 'Digits 1–9 except 5; levels 8–10 also show a letter.',
    primaryMetric: 'Accuracy',
    difficultyAxis: 'Task switching level',
    confounds: ['Response speed and device latency', 'Rule learning', 'Sustained attention, fatigue, and practice effects'],
    validityRules: ['Omissions count as errors.', 'Timing drift over 300 ms or a hidden tab invalidates the block.', 'High omission, anticipation, or stuck-key rates are flagged.']
  };
  const links = [
    {capability: 'Adaptation › Behavioral flexibility', weight: '0.8', kind: 'primary', note: 'Changes in the cue require changing the active classification rule.'},
    {capability: 'Attention › Attentional switching', weight: '0.8', kind: 'primary', note: 'Switch and repeat trials separate switching demand from general task demand.'},
    {capability: 'Information processing › Cognitive speed', weight: '0.4', kind: 'secondary', note: 'Response windows shorten across harder levels.'},
    {capability: 'Execution › Response speed', weight: '0.2', kind: 'confound', note: 'Keyboard and device latency affect reaction-time measures.'}
  ];
  const profile = {
    metricKey: 'accuracy',
    metricName: 'Accuracy',
    unit: '%',
    axis: {
      min: 0.5,
      max: 1,
      ticks: [0.5, 0.75, 0.9, 1],
      referenceLines: [
        {value: 0.75, label: 'developing ≥ 0.75'},
        {value: 0.9, label: 'mastered ≥ 0.90'}
      ]
    }
  };
  const ui = {start: null, handleInput: null, finish: null};

  function resolveLevel(level) {
    const id = typeof level === 'number' ? level : level && level.id;
    return LEVELS.find(item => item.id === id) || LEVELS[0];
  }

  function nameOf(level) {
    const item = resolveLevel(level);
    return 'Level ' + item.id + ' — ' + item.tier;
  }

  function levelSummary(level) {
    const item = resolveLevel(level);
    const rules = item.rules.join('/');
    const rate = item.switchRate === 1 ? '100% switching' :
      item.switchRate === 0 ? 'pure rule' : Math.round(item.switchRate * 100) + '% switching';
    const difficulty = item.id === 10 ? 'Very unlikely to be performed accurately.' : '';
    return rules + ' · ' + rate + ' · CSI ' + (item.cueFlash ? '80 ms cue flash' : item.csi + ' ms') +
      ' · ' + item.responseWindow + ' ms response window' + (difficulty ? ' · ' + difficulty : '');
  }

  function ruleText(level) {
    const item = resolveLevel(level);
    let text = 'Cue P: odd = F, even = J. Cue M: below 5 = F, above 5 = J.';
    if (item.rules.includes('V')) text += ' Cue V: vowels A, E, I, U = F; consonants B, D, F, G, K, M, P, R, S, T = J.';
    if (item.id === 10) {
      return 'Level 10 uses intentionally inconsistent mappings: P stays odd = F/even = J; M is inverted (above 5 = F, below 5 = J); V is inverted (consonants = F, vowels = J). These inversions apply only at Level 10. The cue flashes for 80 ms with the stimulus.';
    }
    if (item.id === 3) text += ' The rules follow a predictable P-P-M-M (AABB) sequence.';
    return text;
  }

  function cueSequence(level, count, random) {
    const item = resolveLevel(level);
    const cues = item.rules;
    if (cues.length === 1) return new Array(count).fill(cues[0]);
    if (item.id === 3) return Array.from({length: count}, (_, index) => cues[Math.floor(index / 2) % 2]);
    if (cues.length === 3 && item.switchRate === 1) {
      const cycle = common.shuffle(cues.slice(), random);
      return Array.from({length: count}, (_, index) => cycle[index % cycle.length]);
    }
    if (cues.length === 3 && item.switchRate > 0 && item.switchRate < 1) {
      const base = Math.floor(count / cues.length);
      const extra = count % cues.length;
      const targetSwitches = Math.round((count - 1) * item.switchRate);
      for (let attempt = 0; attempt < 500; attempt++) {
        const extraCues = new Set(common.shuffle(cues.slice(), random).slice(0, extra));
        const balanced = [];
        cues.forEach(cue => {
          const cueCount = base + (extraCues.has(cue) ? 1 : 0);
          for (let index = 0; index < cueCount; index++) balanced.push(cue);
        });
        common.shuffle(balanced, random);
        let transitions = 0;
        for (let index = 1; index < balanced.length; index++) {
          if (balanced[index] !== balanced[index - 1]) transitions++;
        }
        if (transitions === targetSwitches) return balanced;
      }
    }

    const switches = Math.min(count - 1, Math.round((count - 1) * item.switchRate));
    const positions = common.shuffle(Array.from({length: count - 1}, (_, index) => index + 1), random)
      .slice(0, switches);
    const switchSet = new Set(positions);
    const sequence = [cues[Math.floor(random() * cues.length)]];
    const counts = Object.fromEntries(cues.map(cue => [cue, 1]));
    for (let index = 1; index < count; index++) {
      const current = sequence[index - 1];
      if (!switchSet.has(index)) {
        sequence.push(current);
        counts[current]++;
        continue;
      }
      const choices = cues.filter(cue => cue !== current);
      const fewest = Math.min(...choices.map(cue => counts[cue]));
      const balancedChoices = choices.filter(cue => counts[cue] === fewest);
      const next = balancedChoices[Math.floor(random() * balancedChoices.length)];
      sequence.push(next);
      counts[next]++;
    }
    return sequence;
  }

  function correctKey(rule, digit, letter, level) {
    const id = resolveLevel(level).id;
    if (rule === 'P') return digit % 2 === 1 ? 'F' : 'J';
    if (rule === 'M') {
      if (id === 10) return digit > 5 ? 'F' : 'J';
      return digit < 5 ? 'F' : 'J';
    }
    if (rule === 'V') {
      const vowel = VOWELS.includes(letter);
      if (id === 10) return vowel ? 'J' : 'F';
      return vowel ? 'F' : 'J';
    }
    return null;
  }

  function congruent(digit, letter, level) {
    const item = resolveLevel(level);
    const mappings = item.rules.map(rule => correctKey(rule, digit, letter, item));
    return mappings.every(key => key === mappings[0]);
  }

  function makeStimuli(item, cue, previousDigit, lastKey, keyRun, desiredCongruent, random) {
    let candidates = [];
    for (const digit of DIGITS) {
      if (digit === previousDigit) continue;
      const letters = item.rules.includes('V') ? VOWELS.concat(CONSONANTS) : [null];
      for (const letter of letters) {
        const key = correctKey(cue, digit, letter, item);
        if (keyRun >= 4 && key === lastKey) continue;
        candidates.push({digit, letter, key, congruent: congruent(digit, letter, item)});
      }
    }
    if (!candidates.length) {
      for (const digit of DIGITS) {
        const letters = item.rules.includes('V') ? VOWELS.concat(CONSONANTS) : [null];
        for (const letter of letters) candidates.push({digit, letter, key: correctKey(cue, digit, letter, item), congruent: congruent(digit, letter, item)});
      }
    }
    if (keyRun >= 4) {
      const alternateKeys = candidates.filter(candidate => candidate.key !== lastKey);
      if (alternateKeys.length) candidates = alternateKeys;
    }
    const targetCongruency = candidates.filter(candidate => candidate.congruent === desiredCongruent);
    if (targetCongruency.length) candidates = targetCongruency;
    const selected = candidates[Math.floor(random() * candidates.length)];
    return selected;
  }

  function generate(level, seed, mode) {
    const item = resolveLevel(level);
    const trialMode = mode === 'practice' ? 'practice' : 'assessment';
    const count = trialMode === 'practice' ? PRACTICE : SCORED;
    const random = common.rng(seed);
    const cues = cueSequence(item, count, random);
    const congruencyPattern = common.shuffle(
      Array.from({length: count}, (_, index) => index < Math.floor(count / 2)),
      random
    );
    const trials = [];
    let previousDigit = null;
    let lastKey = null;
    let keyRun = 0;
    for (let index = 0; index < count; index++) {
      const cue = cues[index];
      const stimulus = makeStimuli(item, cue, previousDigit, lastKey, keyRun, congruencyPattern[index], random);
      const switched = index > 0 && cue !== cues[index - 1];
      const repeated = index > 0 && !switched;
      const trial = {
        index,
        cue,
        rule: cue,
        digit: stimulus.digit,
        letter: stimulus.letter,
        stimulus: stimulus.letter ? stimulus.letter + stimulus.digit : String(stimulus.digit),
        correctKey: stimulus.key,
        switched,
        repeated,
        switch: switched,
        congruent: stimulus.congruent,
        csi: item.csi,
        cueFlash: item.cueFlash || 0,
        responseWindow: item.responseWindow,
        mode: trialMode
      };
      trials.push(trial);
      previousDigit = stimulus.digit;
      keyRun = stimulus.key === lastKey ? keyRun + 1 : 1;
      lastKey = stimulus.key;
    }
    return {
      levelId: item.id,
      seed,
      mode: trialMode,
      totalTrials: count,
      scoredTrials: SCORED,
      practiceTrials: PRACTICE,
      csi: item.csi,
      cueFlash: item.cueFlash || 0,
      responseWindow: item.responseWindow,
      trials
    };
  }

  function responseKey(response) {
    if (response == null) return null;
    if (typeof response === 'string') return response.toUpperCase();
    const key = response.key != null ? response.key : response.response;
    return key == null ? null : String(key).toUpperCase();
  }

  function responseRt(response) {
    if (!response || typeof response !== 'object') return null;
    const value = response.rt != null ? response.rt : response.rtMs;
    return Number.isFinite(value) ? value : null;
  }

  function score(level, spec, responses, seed, baselineBlocks) {
    const item = resolveLevel(level);
    const trials = spec && Array.isArray(spec.trials) ? spec.trials : [];
    const answers = Array.isArray(responses) ? responses : [];
    let correct = 0;
    let omissions = 0;
    let responseCount = 0;
    const correctRts = [];
    const switchRts = [];
    const repeatRts = [];
    let switchCorrect = 0;
    let repeatCorrect = 0;
    const ruleRepeatRts = {};
    const keyCounts = {F: 0, J: 0};
    let anticipations = 0;
    for (let index = 0; index < trials.length; index++) {
      const trial = trials[index];
      const answer = answers[index];
      const key = responseKey(answer);
      const rt = responseRt(answer);
      if (key !== null) {
        responseCount++;
        if (keyCounts[key] != null) keyCounts[key]++;
        if (rt !== null && rt < 150) anticipations++;
      }
      if (key === null) {
        omissions++;
        continue;
      }
      if (key !== trial.correctKey) continue;
      correct++;
      if (trial.switched) switchCorrect++;
      if (trial.repeated) repeatCorrect++;
      if (rt !== null) {
        correctRts.push(rt);
        if (trial.switched) {
          switchRts.push(rt);
        } else if (trial.repeated) {
          repeatRts.push(rt);
          if (!ruleRepeatRts[trial.rule]) ruleRepeatRts[trial.rule] = [];
          ruleRepeatRts[trial.rule].push(rt);
        }
      }
    }

    const accuracy = trials.length ? correct / trials.length : null;
    const switchDifference = common.bootstrapMedianDifference(switchRts, repeatRts, seed, 1000);
    const switchCost = switchDifference ? {
      estimate: switchDifference.estimate,
      lower: switchDifference.lower,
      upper: switchDifference.upper,
      ci: {lower: switchDifference.lower, upper: switchDifference.upper},
      width: switchDifference.upper - switchDifference.lower,
      reliable: switchCorrect >= 10 && repeatCorrect >= 10 && switchDifference.upper - switchDifference.lower <= 150,
      label: switchCorrect < 10 || repeatCorrect < 10 || switchDifference.upper - switchDifference.lower > 150 ? 'unreliable' : 'reliable',
      switchCorrect,
      repeatCorrect,
      switchRtCount: switchRts.length,
      repeatRtCount: repeatRts.length
    } : 'unavailable';

    const baselineByRule = {};
    (baselineBlocks || []).forEach(block => {
      if (!block || block.valid !== true) return;
      if (block.mode && block.mode !== 'assessment') return;
      const levelId = block.levelId != null ? block.levelId : block.level;
      if (Number(levelId) !== 1 && Number(levelId) !== 2) return;
      const rule = Number(levelId) === 1 ? 'P' : 'M';
      const rt = block.medianRt != null ? block.medianRt :
        block.rt != null ? block.rt :
          block.metrics && (block.metrics.medianRt != null ? block.metrics.medianRt : block.metrics.rt);
      if (Number.isFinite(rt)) baselineByRule[rule] = rt;
    });
    const mixingCostByRule = {};
    Object.keys(ruleRepeatRts).forEach(rule => {
      if (Number.isFinite(baselineByRule[rule])) {
        mixingCostByRule[rule] = common.median(ruleRepeatRts[rule]) - baselineByRule[rule];
      }
    });
    const mixingRules = Object.keys(mixingCostByRule);
    const mixingCost = mixingRules.length
      ? common.median(mixingRules.map(rule => mixingCostByRule[rule]))
      : 'needs a baseline';

    const validResponseRts = answers.map(responseRt).filter(rt => rt !== null);
    const sameKeyRate = responseCount ? Math.max(keyCounts.F, keyCounts.J) / responseCount : 0;
    return {
      levelId: item.id,
      total: trials.length,
      correct,
      accuracy,
      omissions,
      omissionRate: trials.length ? omissions / trials.length : 0,
      responseCount,
      medianRt: common.median(correctRts),
      rt: common.median(correctRts),
      switchCost,
      mixingCost,
      mixingCostByRule,
      switchCorrect,
      repeatCorrect,
      keyCounts,
      stuckKeyRate: sameKeyRate,
      anticipationCount: anticipations,
      anticipationRate: responseCount ? anticipations / responseCount : 0,
      timing: {
        max: spec && spec.timing ? spec.timing.max : undefined,
        tabHidden: !!(spec && spec.timing && (spec.timing.tabHidden || spec.timing.hidden))
      },
      validResponseRtCount: validResponseRts.length
    };
  }

  function validate(metrics, level, timing) {
    const item = resolveLevel(level);
    const flags = [];
    let valid = true;
    const total = metrics && Number.isFinite(metrics.total) ? metrics.total : 0;
    const responses = metrics && Number.isFinite(metrics.responseCount) ? metrics.responseCount : 0;
    const omissions = metrics && Number.isFinite(metrics.omissions) ? metrics.omissions : total - responses;
    const omissionRate = metrics && Number.isFinite(metrics.omissionRate)
      ? metrics.omissionRate : total ? omissions / total : 0;
    const anticipationRate = metrics && Number.isFinite(metrics.anticipationRate) ? metrics.anticipationRate : 0;
    const stuckKeyRate = metrics && Number.isFinite(metrics.stuckKeyRate) ? metrics.stuckKeyRate : 0;
    const timingInfo = timing || (metrics && metrics.timing) || {};

    if (!responses) {
      valid = false;
      flags.push('no_responses');
    }
    if (timingInfo.max > 300 || timingInfo.tabHidden || timingInfo.hidden || timingInfo.visibility === 'hidden') {
      valid = false;
      flags.push('timing_invalid');
    }
    if (omissionRate > 0.25) flags.push('omissions');
    if (anticipationRate > 0.15) flags.push('anticipations');
    if (stuckKeyRate > 0.9) flags.push('stuck_key');
    if (item.id >= 3 && item.id <= 10) {
      if ((metrics.switchCorrect || 0) < 10) flags.push('few_switch_correct');
      if ((metrics.repeatCorrect || 0) < 10) flags.push('few_repeat_correct');
    }
    return {valid, flags};
  }

  function statusOf(value) {
    if (value == null || !Number.isFinite(Number(value))) return 'Unassessed';
    const accuracy = Number(value);
    return accuracy >= 0.9 ? 'Mastered' : accuracy >= 0.75 ? 'Developing' : 'Not yet';
  }

  function statusPolicy(blocks) {
    const valid = (blocks || []).map((block, index) => ({block, index}))
      .filter(entry => entry.block && entry.block.valid && entry.block.mode === 'assessment' &&
        Number.isFinite(entry.block.accuracy))
      .sort((left, right) => {
        const a = left.block.ts;
        const b = right.block.ts;
        if (a == null || b == null) return left.index - right.index;
        return a < b ? -1 : a > b ? 1 : left.index - right.index;
      });
    if (!valid.length) return {status: 'Unassessed', n: 0};
    const recent = valid.slice(-3).map(entry => entry.block.accuracy);
    const meanAccuracy = common.mean(recent);
    return {
      status: statusOf(meanAccuracy),
      n: valid.length,
      meanAccuracy,
      meanValue: meanAccuracy,
      first: valid[0].block.accuracy,
      latest: valid[valid.length - 1].block.accuracy,
      evidence: common.evidence(valid.length)
    };
  }

  function suggestedLevel(blocks) {
    for (const item of LEVELS) {
      const result = statusPolicy((blocks || []).filter(block => block.levelId === item.id));
      if (result.status !== 'Mastered') return item.id;
    }
    return LEVELS.length;
  }

  function flagText(flag) {
    const descriptions = {
      no_responses: 'No responses were made, so this block cannot be scored.',
      timing_invalid: 'Timing drift exceeded 300 ms or the tab was hidden; discard this block as evidence.',
      omissions: 'More than 25% of trials were omitted. Omissions count as errors.',
      anticipations: 'More than 15% of responses were made before 150 ms.',
      stuck_key: 'More than 90% of responses used the same key.',
      few_switch_correct: 'Fewer than 10 correct switch trials; switch cost is not reliable.',
      few_repeat_correct: 'Fewer than 10 correct repeat trials; switch cost is not reliable.'
    };
    return descriptions[flag] || flag;
  }

  function recommend(level, metrics, valid) {
    const item = resolveLevel(level);
    if (!valid) return {text: 'This block could not be counted as evidence (see flags). Try again when timing and attention are stable.', next: item.id};
    const accuracy = metrics && metrics.accuracy;
    if (accuracy >= 0.9) {
      return item.id < LEVELS.length
        ? {text: 'Mastered this level. Next: Level ' + (item.id + 1) + '.', next: item.id + 1}
        : {text: 'Level 10 is very unlikely to be performed accurately. Repeat to confirm this result.', next: item.id};
    }
    if (accuracy >= 0.75) return {text: 'Developing at this level. Repeat it to confirm performance.', next: item.id};
    return item.id > 1
      ? {text: 'Accuracy is below the developing threshold. Try Level ' + (item.id - 1) + '.', next: item.id - 1}
      : {text: 'Accuracy is below the developing threshold at Level 1. Review the instructions and input device.', next: item.id};
  }

  window.HCCTSwitchingEngine = Object.freeze({
    id: 'switching',
    name: 'Task switching ladder',
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
    SCORED,
    PRACTICE,
    VOWELS,
    CONSONANTS,
    correctKey
  });
})();
