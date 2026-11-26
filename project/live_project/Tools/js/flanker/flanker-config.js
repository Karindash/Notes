(function () {
  const defaults = {
    MASK_LETTERS: 'B D F G J L M N P Q R T V W X Z'.split(' '),
    GROUPS: {H: 'F', K: 'F', S: 'J', C: 'J'},
    TARGETS_BY_KEY: {F: ['H', 'K'], J: ['S', 'C']},
    SCORED: 60,
    PRACTICE: 12,
    THRESHOLDS: {
      mastered: 0.9,
      developing: 0.75,
      maxDriftMs: 300,
      maxOmissionRate: 0.25,
      anticipationMs: 150,
      maxAnticipationRate: 0.15,
      stuckKeyRate: 0.9,
      meanDriftMs: 40,
      minCorrectPerCondition: 10,
      maxInterferenceIntervalMs: 100
    },
    LEVELS: [
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
    ]
  };
  if (!window.HCCTSettings) throw new Error('settings-store must load before flanker-config.');

  function validate(config) {
    const thresholds = config.THRESHOLDS;
    if (!Number.isInteger(config.SCORED) || config.SCORED < 2 || config.SCORED % 2 ||
        config.SCORED > 1000 || !Number.isInteger(config.PRACTICE) ||
        config.PRACTICE < 1 || config.PRACTICE > 500) return 'trial counts must be bounded and scored trials even.';
    if (!(thresholds.mastered > thresholds.developing && thresholds.developing >= 0.5 && thresholds.mastered <= 1) ||
        !(thresholds.maxOmissionRate >= 0 && thresholds.maxOmissionRate <= 1) ||
        !(thresholds.maxAnticipationRate >= 0 && thresholds.maxAnticipationRate <= 1) ||
        !(thresholds.stuckKeyRate > 0 && thresholds.stuckKeyRate <= 1) ||
        !Number.isInteger(thresholds.minCorrectPerCondition) ||
        thresholds.minCorrectPerCondition < 1 || thresholds.minCorrectPerCondition > config.SCORED / 2) {
      return 'accuracy thresholds must be consistent with the number of trials.';
    }
    if (config.LEVELS.some(level => !Number.isInteger(level.stringLength) || level.stringLength < 1 ||
        level.stringLength > 99 || level.stringLength % 2 !== 1 ||
        level.responseWindowMs <= 0 || level.responseWindowMs > 60000 ||
        level.maskMs > 60000 ||
        (level.exposureMs !== null && (level.exposureMs <= 0 || level.exposureMs > 60000)))) {
      return 'level timing or string length is invalid.';
    }
    if (Object.keys(config.TARGETS_BY_KEY).some(key => !['F', 'J'].includes(key)) ||
        Object.values(config.TARGETS_BY_KEY).some(targets => !targets.length ||
          targets.some(target => config.GROUPS[target] == null))) return 'target mappings are invalid.';
    const targets = Object.keys(config.GROUPS);
    if (config.MASK_LETTERS.some(letter => !/^[A-Z]$/.test(letter) || targets.includes(letter))) {
      return 'mask letters must be single letters outside the response mapping.';
    }
    return true;
  }

  const configuration = window.HCCTSettings.applyTaskConfig('flanker', defaults, validate);
  const {MASK_LETTERS, GROUPS, TARGETS_BY_KEY, SCORED, PRACTICE, THRESHOLDS} = configuration;
  const LEVELS = Object.freeze(configuration.LEVELS.map(level =>
    Object.freeze({...level, ms: level.responseWindowMs})));

  window.HCCTFlankerConfig = Object.freeze({
    ...configuration,
    LEVELS,
    configuration
  });
})();
