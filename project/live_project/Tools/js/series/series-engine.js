(function () {
  const config = window.HCCTSeriesConfig;
  const patterns = window.HCCTSeriesPatterns;
  const generation = window.HCCTSeriesGeneration;
  const scoring = window.HCCTSeriesScoring;
  const policy = window.HCCTSeriesPolicy;
  if (!config || !patterns || !generation || !scoring || !policy) {
    throw new Error('Series modules must be loaded before series-engine.');
  }

  const {LIMIT, PRACTICE, SCORED, LEVELS} = config;
  const configuration = config.configuration;
  const {consistentAnswers, FAMILY_CHECKERS} = patterns;
  const {generate, generateFamily} = generation;
  const levelFor = generation.levelFor;
  const {score, validate} = scoring;
  const {statusOf, statusPolicy, suggestedLevel, recommend} = policy;

  const meta = Object.freeze({
    id: 'series',
    name: 'Number and Letter Series',
    groups: ['Reasoning', 'Information processing'],
    construct: 'Inductive reasoning: finding a rule in a sequence and applying it.',
    procedure: 'Type the missing next term, or choose “Can’t be determined” when the shown terms do not identify a unique answer.',
    stimuli: 'Integer and A–Z series; letters never wrap past Z.',
    primaryMetric: 'Correct answers (out of ' + SCORED + ')',
    difficultyAxis: 'Series level',
    confounds: ['Arithmetic fluency and prior exposure to number series', 'Typing speed affects response time, not accuracy'],
    validityRules: [
      'All timeouts or a hidden tab mid-item: block is invalid.',
      'More than ' + config.THRESHOLDS.maxTimeouts + ' timeouts or all “Can’t be determined” responses: warning.'
    ]
  });

  const links = Object.freeze([
    {capability: 'Reasoning › Inductive reasoning', weight: '0.8', kind: 'primary', note: 'Infer a rule from observed terms and apply it to the missing term.'},
    {capability: 'Information processing › Abstraction', weight: '0.5', kind: 'primary', note: 'Represent a sequence with a compact rule.'},
    {capability: 'Memory › Working memory', weight: '0.4', kind: 'secondary', note: 'Keep several terms available while comparing their relationships.'},
    {capability: 'Metacognition › Self monitoring', weight: '0.3', kind: 'secondary', note: 'Recognize when the available terms do not determine one answer.'},
    {capability: 'Arithmetic fluency and prior exposure to number series', weight: 'n/a', kind: 'confound', note: 'Familiarity can affect performance independently of inductive reasoning.'},
    {capability: 'Typing speed', weight: 'n/a', kind: 'confound', note: 'Typing speed affects response time, not accuracy.'}
  ].map(Object.freeze));

  const scoreTickStep = Math.max(1, Math.ceil(SCORED / 8));
  const scoreTicks = Array.from(
    {length: Math.floor(SCORED / scoreTickStep) + 1},
    (_, index) => index * scoreTickStep
  );
  if (scoreTicks[scoreTicks.length - 1] !== SCORED) scoreTicks.push(SCORED);

  const profile = Object.freeze({
    metricKey: 'correctCount',
    metricName: 'Items correct',
    unit: 'items',
    axis: {
      min: 0,
      max: SCORED,
      ticks: [...new Set([
        ...scoreTicks,
        config.THRESHOLDS.developing,
        config.THRESHOLDS.mastered
      ])].sort((left, right) => left - right),
      referenceLines: [
        {value: config.THRESHOLDS.developing, label: 'developing ≥ ' + config.THRESHOLDS.developing},
        {value: config.THRESHOLDS.mastered, label: 'mastered ≥ ' + config.THRESHOLDS.mastered}
      ]
    },
    detailMetrics: ['falseDeclines', 'falseAnswers']
  });

  const ui = Object.freeze({start: null, handleInput: null, finish: null});

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
    configuration,
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
