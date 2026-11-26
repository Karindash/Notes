(function () {
  const config = window.HCCTNBackConfig;
  const common = window.HCCTTaskEngineCommon;
  const generation = window.HCCTNBackGeneration;
  const scoring = window.HCCTNBackScoring;
  const policy = window.HCCTNBackPolicy;
  if (!config || !common || !generation || !scoring || !policy) {
    throw new Error('N-back modules and task-engine-common must be loaded before nback-engine.');
  }

  const {LETTERS, MATCH_P, MASTER, DEV, SCORED, PRACTICE, INPUT_KEYS, VALIDATION, LEVELS} = config;
  const {mean} = common;
  const {genSequence, isTarget} = generation;
  const {score, validate, flagText} = scoring;
  const {statusOf, statusPolicy, levelStats, suggestedLevel, recommend} = policy;

  // ---- Level helpers ----

  const nameOf  = level => (level.dual ? 'Dual ' : '') + level.n + '-back';
  const stimMs  = level => Math.min(700, Math.round(level.ms * 0.5));

  function ruleText(level) {
    if (level.n === 0) {
      return `A target letter is shown at the start. Press <b>${INPUT_KEYS.letter.toUpperCase()}</b> (or Space) every time that letter appears.`;
    }
    const step = level.n === 1 ? '1 step back' : `${level.n} steps back`;
    if (!level.dual) {
      return `Letters appear one at a time. Press <b>${INPUT_KEYS.letter.toUpperCase()}</b> (or Space) when the letter is the same as the one <b>${step}</b>.`;
    }
    return `Each item is a letter in a grid position. Press <b>${INPUT_KEYS.position.toUpperCase()}</b> if the <b>position</b> matches the one ${step}. Press <b>${INPUT_KEYS.letter.toUpperCase()}</b> if the <b>letter</b> matches the one ${step}. The two are judged independently: both, one or neither may match.`;
  }

  function generate(level, seed, mode) {
    return genSequence(level, mode === 'practice' ? PRACTICE : SCORED, seed);
  }

  // ---- Metadata ----

  const meta = {
    id: 'nback',
    name: 'N-back ladder',
    groups: ['Working memory'],
    construct: 'Working memory: information manipulation and mental updating.',
    procedure: 'Respond when the current letter matches the letter shown n items earlier. At dual levels, judge letter and position independently.',
    stimuli: 'Letters; dual levels also use positions in a text grid.',
    primaryMetric: 'Sensitivity (d′)',
    difficultyAxis: 'N-back level',
    confounds: [
      'Sustained attention',
      'Response speed and device latency',
      'Strategy, motivation, fatigue, and practice effects',
    ],
    validityRules: [
      'No responses: not scored.',
      `Timing drift over ${config.VALIDATION.maxDriftMs} ms: not scored.`,
      'High false-alarm and hit rates or an ignored dual-task channel are flagged.',
    ],
  };

  const links = [
    { capability: 'Working memory › Information manipulation', weight: '0.8', kind: 'primary',   note: 'Items must be held and compared with the one n steps back.' },
    { capability: 'Working memory › Mental updating',          weight: '0.8', kind: 'primary',   note: 'The window slides every trial: old items drop out, new ones enter.' },
    { capability: 'Attention › Sustained attention',           weight: '0.4', kind: 'secondary', note: 'A block needs 40–90 s of continuous monitoring.' },
    { capability: 'Inhibition › Cognitive inhibition',         weight: '0.3', kind: 'secondary', note: 'Lure trials (n±1 matches) require rejecting items that feel familiar. Only informative at levels that include lures.' },
    { capability: 'Information processing › Cognitive speed',  weight: '0.3', kind: 'secondary', note: 'Grows in importance at levels with 2 s or less per item.' },
    { capability: 'Execution › Response speed',                weight: '0.1', kind: 'confound',  note: 'Keypress speed and device latency mainly affect reaction time, less so d′.' },
    { capability: 'Strategy (rehearsal, chunking, position tricks)', weight: 'n/a', kind: 'confound', note: 'Different strategies change what the score reflects.' },
    { capability: 'Motivation, fatigue, practice effect',      weight: 'n/a', kind: 'confound',  note: 'Handled by baseline comparison, repeated blocks and validity flags, not removed.' },
  ];

  const profile = {
    metricKey:  'dprime',
    metricName: 'Sensitivity (d′)',
    unit:       'd′',
    axis: {
      min: 0,
      max: Math.max(4, MASTER),
      ticks: [...new Set([0, 1, 2, 3, 4, DEV, MASTER])].sort((a, b) => a - b),
      referenceLines: [
        {value: DEV, label: 'developing ≥ ' + DEV},
        {value: MASTER, label: 'mastered ≥ ' + MASTER},
      ],
    },
  };

  const ui = { start: null, handleInput: null, finish: null };
  window.HCCTNBackEngine = Object.freeze({
    id: 'nback',
    name: 'N-back ladder',
    policyType: 'capability',
    configuration: config,
    ui,
    meta,
    links,
    profile,
    ruleText,
    generate,
    statusPolicy,
    levels: LEVELS,
    LETTERS,
    INPUT_KEYS,
    MATCH_P,
    MASTER,
    DEV,
    SCORED,
    PRACTICE,
    LEVELS,
    nameOf,
    stimMs,
    mean,
    genSequence,
    isTarget,
    score,
    validate,
    flagText,
    levelStats,
    suggestedLevel,
    statusOf,
    recommend,
  });
})();
