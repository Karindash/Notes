(function () {
  const config = window.HCCTSwitchingConfig;
  const generation = window.HCCTSwitchingGeneration;
  const scoring = window.HCCTSwitchingScoring;
  const policy = window.HCCTSwitchingPolicy;
  if (!config || !generation || !scoring || !policy) {
    throw new Error('Switching modules must be loaded before switching-engine.');
  }

  const {SCORED, PRACTICE, VOWELS, CONSONANTS, LEVELS} = config;
  const resolveLevel = config.resolveLevel;
  const {generate, correctKey} = generation;
  const {score, validate} = scoring;
  const {statusOf, statusPolicy, suggestedLevel, flagText, recommend} = policy;

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
    validityRules: [
      'Omissions count as errors.',
      `Timing drift over ${config.THRESHOLDS.maxDriftMs} ms or a hidden tab invalidates the block.`,
      `Omission, anticipation, and stuck-key flags use the configured rates (${Math.round(config.THRESHOLDS.maxOmissionRate * 100)}%, ${Math.round(config.THRESHOLDS.maxAnticipationRate * 100)}%, ${Math.round(config.THRESHOLDS.stuckKeyRate * 100)}%).`
    ]
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
      ticks: [...new Set([0.5, 0.75, 0.9, config.THRESHOLDS.developing, config.THRESHOLDS.mastered, 1])]
        .sort((left, right) => left - right),
      referenceLines: [
        {value: config.THRESHOLDS.developing, label: 'developing ≥ ' + config.THRESHOLDS.developing},
        {value: config.THRESHOLDS.mastered, label: 'mastered ≥ ' + config.THRESHOLDS.mastered}
      ]
    }
  };
  const ui = {start: null, handleInput: null, finish: null};

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

  window.HCCTSwitchingEngine = Object.freeze({
    id: 'switching',
    name: 'Task switching ladder',
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
    PRACTICE,
    VOWELS,
    CONSONANTS,
    correctKey
  });
})();
