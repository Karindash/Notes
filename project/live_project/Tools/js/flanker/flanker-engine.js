(function () {
  const config = window.HCCTFlankerConfig;
  const common = window.HCCTTaskEngineCommon;
  const generation = window.HCCTFlankerGeneration;
  const scoring = window.HCCTFlankerScoring;
  const policy = window.HCCTFlankerPolicy;
  if (!config || !common || !generation || !scoring || !policy) {
    throw new Error('Flanker modules and task-engine-common must be loaded before flanker-engine.');
  }

  const {LEVELS, SCORED, PRACTICE} = config;
  const thresholds = config.THRESHOLDS;
  const {generate} = generation;
  const {score, validate} = scoring;
  const {statusPolicy, flagText, suggestedLevel, statusOf, recommend} = policy;

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
    validityRules: [
      `No responses, timing drift above ${config.THRESHOLDS.maxDriftMs} ms, or a hidden tab invalidates the block.`,
      `Omissions above ${Math.round(config.THRESHOLDS.maxOmissionRate * 100)}%, anticipations above ${Math.round(config.THRESHOLDS.maxAnticipationRate * 100)}%, one key above ${Math.round(config.THRESHOLDS.stuckKeyRate * 100)}%, or mean drift above ${config.THRESHOLDS.meanDriftMs} ms are flagged.`
    ]
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
        Object.freeze({value: thresholds.developing, label: 'developing ≥ ' + thresholds.developing}),
        Object.freeze({value: thresholds.mastered, label: 'mastered ≥ ' + thresholds.mastered})
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

  window.HCCTFlankerEngine = Object.freeze({
    id: 'flanker',
    name: 'Letter Flanker',
    policyType: 'capability',
    configuration: config.configuration,
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
