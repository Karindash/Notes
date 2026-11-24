(function () {
  const common = window.HCCTTaskEngineCommon;
  const MASK_LETTERS = Object.freeze('B D F G J L M N P Q R T V W X Z'.split(' '));
  const GROUPS = Object.freeze({H: 'F', K: 'F', S: 'J', C: 'J'});
  const TARGETS_BY_KEY = Object.freeze({F: Object.freeze(['H', 'K']), J: Object.freeze(['S', 'C'])});
  const SCORED = 60;
  const PRACTICE = 12;

  const LEVELS = Object.freeze([
    {id: 1, tier: 'Easy', stringLength: 1, exposureMs: null, maskMs: 0, responseWindowMs: 3000},
    {id: 2, tier: 'Easy', stringLength: 3, exposureMs: null, maskMs: 0, responseWindowMs: 3000},
    {id: 3, tier: 'Moderate', stringLength: 3, exposureMs: null, maskMs: 0, responseWindowMs: 2500},
    {id: 4, tier: 'Moderate', stringLength: 5, exposureMs: null, maskMs: 0, responseWindowMs: 2000},
    {id: 5, tier: 'Hard', stringLength: 7, exposureMs: null, maskMs: 0, responseWindowMs: 1500},
    {id: 6, tier: 'Hard', stringLength: 7, exposureMs: 200, maskMs: 0, responseWindowMs: 1300},
    {id: 7, tier: 'Very hard', stringLength: 9, exposureMs: 150, maskMs: 0, responseWindowMs: 1200},
    {id: 8, tier: 'Very hard', stringLength: 9, exposureMs: 100, maskMs: 100, responseWindowMs: 1000},
    {id: 9, tier: 'Extreme', stringLength: 11, exposureMs: 50, maskMs: 100, responseWindowMs: 900},
    {id: 10, tier: 'Impossible', stringLength: 11, exposureMs: 17, maskMs: 100, responseWindowMs: 800, exposureIsFrame: true}
  ].map(level => Object.freeze({...level, ms: level.responseWindowMs})));

  const meta = Object.freeze({
    id: 'flanker',
    name: 'Letter Flanker',
    groups: ['Attention', 'Inhibition'],
    construct: 'Selective attention and interference control: responding to the centre letter while ignoring surrounding letters.',
    procedure: 'Report the response group of the middle letter with F or J, ignoring the flankers.',
    stimuli: 'Consonant strings; later levels briefly display the string and then a consonant mask.',
    primaryMetric: 'Incongruent accuracy (L3+) or overall accuracy (L1–L2)',
    difficultyAxis: 'Flanker level',
    confounds: ['Display refresh rate and device timing', 'Response speed', 'Motivation, attention, and practice effects'],
    validityRules: ['No responses, timing drift above 300 ms, or a hidden tab invalidates the block.',
      'Omissions above 25%, anticipations above 15%, one key above 90%, or mean drift above 40 ms are flagged.']
  });

  const links = Object.freeze([
    Object.freeze({capability: 'Attention › Selective attention', weight: '0.7', kind: 'primary', note: 'Respond to the centre letter while filtering irrelevant flankers.'}),
    Object.freeze({capability: 'Inhibition › Cognitive inhibition', weight: '0.5', kind: 'primary', note: 'Incongruent flankers activate the competing response group from L3.'}),
    Object.freeze({capability: 'Information processing › Cognitive speed', weight: '0.3', kind: 'secondary', note: 'Brief exposures increase visual processing demands.'}),
    Object.freeze({capability: 'Perception › Visual recognition', weight: '0.2', kind: 'secondary', note: 'Letters must be identified under short exposures.'}),
    Object.freeze({capability: 'Execution › Response speed', weight: '0.2', kind: 'confound', note: 'Key response speed influences reaction time.'}),
    Object.freeze({capability: 'Display refresh rate, motivation, practice', weight: 'n/a', kind: 'confound', note: 'These factors can affect exposure and performance.'})
  ]);

  const profile = Object.freeze({
    metricKey: 'primaryAccuracy',
    metricName: 'Primary accuracy',
    unit: 'accuracy',
    axis: Object.freeze({
      min: 0.5,
      max: 1,
      ticks: Object.freeze([0.5, 0.6, 0.7, 0.8, 0.9, 1]),
      referenceLines: Object.freeze([
        Object.freeze({value: 0.75, label: 'developing ≥ 0.75'}),
        Object.freeze({value: 0.9, label: 'mastered ≥ 0.90'})
      ])
    })
  });

  const ui = {start: null, handleInput: null, finish: null};

  function nameOf(level) {
    return 'Letter Flanker L' + level.id;
  }

  function levelSummary(level) {
    const exposure = level.exposureMs == null
      ? 'until response'
      : (level.exposureIsFrame ? '1 display frame (~17 ms at 60 Hz)' : level.exposureMs + ' ms') +
        (level.maskMs ? ' + ' + level.maskMs + ' ms mask' : '');
    const condition = level.id === 1 ? 'single letter' : level.id === 2 ? 'neutral flankers' : 'congruent + incongruent';
    return level.tier + ' · ' + level.stringLength + '-letter string · ' + condition +
      ' · ' + exposure + ' · ' + level.responseWindowMs + ' ms response window';
  }

  function ruleText(level) {
    const core = 'Press <b>F</b> for H or K in the centre, or <b>J</b> for S or C. Ignore the surrounding letters.';
    let detail = '';
    if (level.id === 1) detail = ' A single centre letter appears without flankers.';
    else if (level.id === 2) detail = ' The flankers are neutral Xs.';
    else detail = ' Flankers may match the target or activate the opposite response.';
    if (level.id >= 6) detail += ' Very short exposures depend on the display refresh rate.';
    if (level.id === 10) detail += ' This level is designed to be very unlikely to be reliable, not proven impossible.';
    return core + detail;
  }

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

  function getResponse(response) {
    if (response == null) return {key: null, rt: null};
    if (typeof response === 'string') return {key: response.toUpperCase(), rt: null};
    const key = response.key ?? response.responseKey ?? response.response ?? response.pressedKey ?? null;
    const rt = response.rtMs ?? response.rt ?? response.reactionTimeMs ?? null;
    return {
      key: typeof key === 'string' ? key.toUpperCase() : key,
      rt: rt != null && Number.isFinite(Number(rt)) ? Number(rt) : null
    };
  }

  function score(level, spec, responses, seed) {
    const included = spec.trials.map((trial, index) => ({trial, response: getResponse(responses && responses[index]), index}))
      .filter(item => spec.mode === 'practice' || item.trial.scored);
    const names = level.id < 3 ? [level.id === 1 ? 'single' : 'neutral'] : ['congruent', 'incongruent'];
    const conditions = {};
    for (const name of names) {
      const items = included.filter(item => item.trial.type === name);
      const correctRts = [];
      let correct = 0;
      let answered = 0;
      for (const item of items) {
        if (item.response.key === 'F' || item.response.key === 'J') {
          answered++;
          if (item.response.key === item.trial.correctKey) {
            correct++;
            if (item.response.rt != null) correctRts.push(item.response.rt);
          }
        }
      }
      conditions[name] = {
        total: items.length,
        correct,
        answered,
        omissions: items.length - answered,
        accuracy: items.length ? correct / items.length : null,
        medianRt: common.median(correctRts),
        correctRts
      };
    }
    const overallCorrect = included.reduce((sum, item) =>
      sum + (item.response.key === item.trial.correctKey ? 1 : 0), 0);
    const total = included.length;
    const totalResponses = included.reduce((sum, item) =>
      sum + (item.response.key === 'F' || item.response.key === 'J' ? 1 : 0), 0);
    const responseKeys = included.map(item => item.response.key).filter(key => key === 'F' || key === 'J');
    const anticipationCount = included.filter(item =>
      (item.response.key === 'F' || item.response.key === 'J') && item.response.rt != null && item.response.rt < 150
    ).length;
    const overallAccuracy = total ? overallCorrect / total : null;
    const primaryAccuracy = level.id < 3
      ? overallAccuracy
      : conditions.incongruent.accuracy;
    let interferenceCost;
    let reliability;
    if (level.id < 3) {
      interferenceCost = {available: false, reason: 'unavailable', estimate: null, lower: null, upper: null};
      reliability = {status: 'unavailable', reliable: null, reasons: []};
    } else {
      const congruent = conditions.congruent.correctRts;
      const incongruent = conditions.incongruent.correctRts;
      const interval = common.bootstrapMedianDifference(incongruent, congruent, seed, 1000);
      const reasons = [];
      if (!interval) reasons.push('insufficient_correct_responses');
      if (interval && interval.upper - interval.lower > 100) reasons.push('wide_interval');
      if (conditions.congruent.correct < 10 || conditions.incongruent.correct < 10) {
        reasons.push('fewer_than_10_correct_per_condition');
      }
      interferenceCost = interval
        ? {available: true, estimate: interval.estimate, lower: interval.lower, upper: interval.upper}
        : {available: false, reason: 'insufficient_correct_responses', estimate: null, lower: null, upper: null};
      reliability = {status: reasons.length ? 'unreliable' : 'reliable', reliable: reasons.length === 0, reasons};
      if (interferenceCost.available) interferenceCost.unreliable = reasons.length > 0;
    }
    return {
      levelId: level.id,
      conditions,
      total,
      totalResponses,
      omissions: total - totalResponses,
      omissionRate: total ? (total - totalResponses) / total : 0,
      anticipationCount,
      anticipationRate: totalResponses ? anticipationCount / totalResponses : 0,
      responseKeys,
      overallAccuracy,
      primaryAccuracy,
      accuracy: primaryAccuracy,
      interferenceCost,
      reliability
    };
  }

  function validate(metrics, level, timing) {
    const flags = [];
    const responses = metrics.totalResponses || 0;
    const total = metrics.total || 0;
    const keyCounts = {F: 0, J: 0};
    for (const key of metrics.responseKeys || []) if (keyCounts[key] != null) keyCounts[key]++;
    const maxDrift = timing && (timing.max ?? timing.maxDriftMs);
    const meanDrift = timing && (timing.mean ?? timing.meanDriftMs);

    if (responses === 0) flags.push('no_responses');
    if (timing && Number.isFinite(Number(maxDrift)) && Number(maxDrift) > 300) flags.push('timing_invalid');
    if (timing && (timing.hidden || timing.tabHidden)) flags.push('tab_hidden');
    if (total && metrics.omissionRate > 0.25) flags.push('high_omissions');
    if (responses && metrics.anticipationRate > 0.15) flags.push('anticipations');
    if (responses && Math.max(keyCounts.F, keyCounts.J) / responses > 0.9) flags.push('stuck_key');
    if (timing && Number.isFinite(Number(meanDrift)) && Number(meanDrift) > 40) flags.push('timing_drift');
    return {
      valid: !flags.includes('no_responses') && !flags.includes('timing_invalid') && !flags.includes('tab_hidden'),
      flags
    };
  }

  function statusPolicy(blocks) {
    const valid = blocks.filter(block => block.valid && block.mode === 'assessment')
      .slice()
      .sort((left, right) => String(left.ts || left.timestamp || '').localeCompare(String(right.ts || right.timestamp || '')));
    if (!valid.length) return {status: 'Unassessed', n: 0, meanValue: null, evidence: common.evidence(0)};
    const accuracyOf = block => {
      const value = block.primaryAccuracy ?? block.accuracy ?? block.metrics?.primaryAccuracy ?? block.metrics?.accuracy;
      if (Number.isFinite(value)) return value;
      const level = LEVELS.find(candidate => candidate.id === block.levelId);
      if (!level) return null;
      return level.id < 3
        ? block.overallAccuracy ?? block.metrics?.overallAccuracy ?? null
        : block.incongruentAccuracy ?? block.conditions?.incongruent?.accuracy ?? block.metrics?.incongruentAccuracy ?? null;
    };
    const usable = valid
      .map(block => ({block, accuracy: accuracyOf(block)}))
      .filter(item => Number.isFinite(item.accuracy));
    if (!usable.length) return {status: 'Unassessed', n: 0, meanValue: null, evidence: common.evidence(0)};
    const recent = usable.slice(-3);
    const meanAccuracy = common.mean(recent.map(item => item.accuracy));
    return {
      status: statusOf(meanAccuracy),
      n: usable.length,
      meanAccuracy,
      meanValue: meanAccuracy,
      first: usable[0].accuracy,
      latest: usable[usable.length - 1].accuracy,
      evidence: common.evidence(usable.length)
    };
  }

  function flagText(flag) {
    const messages = {
      no_responses: 'No key responses were made, so this block cannot be scored or counted as low ability.',
      timing_invalid: 'Maximum timing drift exceeded 300 ms. The block was discarded as evidence.',
      tab_hidden: 'The tab was hidden during the block, so timing could not be trusted. The block was discarded.',
      high_omissions: 'More than 25% of scored trials were omitted. Interpret accuracy cautiously.',
      anticipations: 'More than 15% of responses were faster than 150 ms. Some may be anticipatory.',
      stuck_key: 'More than 90% of responses used one key. Check that both response keys work.',
      timing_drift: 'Mean timing drift exceeded 40 ms. Device timing may affect the results.'
    };
    return messages[flag] || flag;
  }

  function suggestedLevel(blocks) {
    for (const level of LEVELS) {
      const evidence = statusPolicy(blocks.filter(block => block.levelId === level.id));
      if (evidence.status !== 'Mastered') return level.id;
    }
    return LEVELS[LEVELS.length - 1].id;
  }

  function statusOf(value) {
    if (!Number.isFinite(value)) return 'Unassessed';
    return value >= 0.9 ? 'Mastered' : value >= 0.75 ? 'Developing' : 'Not yet';
  }

  function recommend(level, metrics, valid) {
    if (!valid) return {
      text: 'This block could not be counted as evidence (see flags). Try again when timing and attention are reliable.',
      next: level.id
    };
    const accuracy = metrics.primaryAccuracy ?? metrics.accuracy;
    if (accuracy >= 0.9) {
      return level.id < LEVELS.length
        ? {text: 'Strong accuracy. Next: Level ' + (level.id + 1) + '.', next: level.id + 1}
        : {text: 'Level 10 is designed to be very unlikely to be reliable; repeat it before drawing a conclusion.', next: level.id};
    }
    if (accuracy >= 0.75) return {text: 'Developing accuracy. Repeat this level for more evidence.', next: level.id};
    return level.id > 1
      ? {text: 'Accuracy is below the developing threshold. Try Level ' + (level.id - 1) + '.', next: level.id - 1}
      : {text: 'Accuracy is low at Level 1. Review the response mapping and check your input device.', next: 1};
  }

  window.HCCTFlankerEngine = Object.freeze({
    id: 'flanker',
    name: 'Letter Flanker',
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
    PRACTICE
  });
})();
