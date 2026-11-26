(function () {
  const defaults = {
    LIMIT: 9999,
    PRACTICE: 2,
    SCORED: 8,
    RETRY_LIMIT: 2000,
    FAMILY_ORDER: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'],
    THRESHOLDS: {mastered: 7, developing: 5, maxTimeouts: 3},
    LEVELS: [
      {id: 1, tier: 'Easy', families: ['C1'], terms: 5, timeSeconds: 20, underdetermined: 0},
      {id: 2, tier: 'Easy', families: ['C1'], terms: 5, timeSeconds: 20, underdetermined: 0},
      {id: 3, tier: 'Moderate', families: ['C2'], terms: 5, timeSeconds: 20, underdetermined: 0},
      {id: 4, tier: 'Moderate', families: ['C3'], terms: 6, timeSeconds: 30, underdetermined: 0},
      {id: 5, tier: 'Hard', families: ['C4'], terms: 7, timeSeconds: 30, underdetermined: 1},
      {id: 6, tier: 'Hard', families: ['C5'], terms: 6, timeSeconds: 30, underdetermined: 1},
      {id: 7, tier: 'Very hard', families: ['C6', 'C7'], terms: 7, timeSeconds: 45, underdetermined: 1},
      {id: 8, tier: 'Very hard', families: ['C8'], terms: 6, timeSeconds: 45, underdetermined: 1},
      {id: 9, tier: 'Extreme', families: ['C9'], terms: 7, timeSeconds: 45, underdetermined: 1},
      {id: 10, tier: 'Impossible', families: ['C6', 'C7', 'C9'], terms: [5, 7], timeSeconds: 45, underdetermined: 4}
    ]
  };
  if (!window.HCCTSettings) throw new Error('settings-store must load before series-config.');

  function validate(config) {
    const thresholds = config.THRESHOLDS;
    if (!Number.isInteger(config.LIMIT) || config.LIMIT < 1 ||
        config.LIMIT > 10000 || !Number.isInteger(config.RETRY_LIMIT) ||
        config.RETRY_LIMIT < 1 || config.RETRY_LIMIT > 10000 ||
        !Number.isInteger(config.SCORED) || config.SCORED < 1 || config.SCORED > 100 ||
        !Number.isInteger(config.PRACTICE) || config.PRACTICE < 1 || config.PRACTICE > 100) {
      return 'limits and trial counts must be within supported bounds.';
    }
    if (!Number.isInteger(thresholds.mastered) || !Number.isInteger(thresholds.developing) ||
        thresholds.developing < 0 || thresholds.mastered <= thresholds.developing ||
        thresholds.mastered > config.SCORED || !Number.isInteger(thresholds.maxTimeouts) ||
        thresholds.maxTimeouts < 0 || thresholds.maxTimeouts > config.SCORED) return 'score thresholds are inconsistent.';
    if (new Set(config.FAMILY_ORDER).size !== config.FAMILY_ORDER.length ||
        config.FAMILY_ORDER.some(family => !/^C[1-9]$/.test(family))) return 'family order is invalid.';
    if (config.LEVELS.some(level => level.timeSeconds <= 0 || level.timeSeconds > 600 ||
        !Number.isInteger(level.underdetermined) || level.underdetermined < 0 ||
        level.underdetermined > config.SCORED ||
        !level.families.length || level.families.some(family => !config.FAMILY_ORDER.includes(family)) ||
        (Array.isArray(level.terms)
          ? level.terms.length !== 2 || !level.terms.every(Number.isInteger) || level.terms[0] < 1 ||
            level.terms[1] < level.terms[0] || level.terms[1] > 100
          : !Number.isInteger(level.terms) || level.terms < 1 || level.terms > 100))) return 'level parameters are invalid.';
    return true;
  }

  const configuration = window.HCCTSettings.applyTaskConfig('series', defaults, validate);
  const {LIMIT, PRACTICE, SCORED, RETRY_LIMIT, FAMILY_ORDER, THRESHOLDS} = configuration;
  const LEVELS = Object.freeze(configuration.LEVELS.map(level => Object.freeze({
    ...level,
    family: level.families.join(', '),
    itemCount: SCORED,
    practiceCount: PRACTICE,
    ms: level.timeSeconds * 1000,
    timeLimitMs: level.timeSeconds * 1000
  })));

  window.HCCTSeriesConfig = Object.freeze({
    ...configuration,
    LEVELS,
    configuration
  });
})();
