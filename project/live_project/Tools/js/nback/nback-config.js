(function () {
  const defaults = {
    LETTERS: ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'],
    MATCH_P: 0.3,
    MASTER: 2,
    DEV: 1,
    SCORED: 30,
    PRACTICE: 14,
    INPUT_KEYS: {letter: 'l', position: 'a'},
    VALIDATION: {maxDriftMs: 300, warningMeanDriftMs: 40, warningMaxDriftMs: 120},
    LEVELS: [
      {id: 1, tier: 'Easy', n: 0, dual: false, ms: 2500, lure: 0},
      {id: 2, tier: 'Easy', n: 1, dual: false, ms: 2500, lure: 0},
      {id: 3, tier: 'Moderate', n: 2, dual: false, ms: 2500, lure: 0},
      {id: 4, tier: 'Moderate', n: 2, dual: false, ms: 2000, lure: 0.20},
      {id: 5, tier: 'Hard', n: 3, dual: false, ms: 2500, lure: 0.15},
      {id: 6, tier: 'Hard', n: 3, dual: false, ms: 2000, lure: 0.25},
      {id: 7, tier: 'Hard', n: 4, dual: false, ms: 2000, lure: 0.25},
      {id: 8, tier: 'Very hard', n: 2, dual: true, ms: 2500, lure: 0.15},
      {id: 9, tier: 'Very hard', n: 3, dual: true, ms: 2500, lure: 0.20},
      {id: 10, tier: 'Extreme', n: 3, dual: true, ms: 2000, lure: 0.25},
      {id: 11, tier: 'Extreme', n: 5, dual: true, ms: 1800, lure: 0.30},
      {id: 12, tier: 'Impossible', n: 7, dual: true, ms: 1000, lure: 0.40}
    ]
  };
  if (!window.HCCTSettings) throw new Error('settings-store must load before nback-config.');

  function validate(config) {
    if (!Number.isInteger(config.SCORED) || config.SCORED < 1 ||
        config.SCORED > 500 || !Number.isInteger(config.PRACTICE) ||
        config.PRACTICE < 1 || config.PRACTICE > 200) return 'trial counts must be between 1 and 500 scored / 200 practice items.';
    if (!(config.MATCH_P > 0 && config.MATCH_P < 1) || !(config.MASTER > config.DEV && config.DEV >= 0)) {
      return 'match probability and status thresholds are inconsistent.';
    }
    if (config.MASTER > 10) return 'status thresholds must not exceed 10.';
    if (config.LETTERS.length < 2 || new Set(config.LETTERS).size !== config.LETTERS.length ||
        config.LETTERS.some(letter => !/^[A-Z]$/.test(letter))) return 'letters must be unique single uppercase letters.';
    if (config.INPUT_KEYS.letter.length !== 1 || config.INPUT_KEYS.position.length !== 1 ||
        config.INPUT_KEYS.letter === config.INPUT_KEYS.position) return 'response keys must be distinct single characters.';
    if (!(config.VALIDATION.maxDriftMs <= 60000 &&
        config.VALIDATION.warningMeanDriftMs <= config.VALIDATION.warningMaxDriftMs &&
        config.VALIDATION.warningMaxDriftMs <= config.VALIDATION.maxDriftMs)) return 'timing thresholds must be ordered.';
    if (config.LEVELS.some(level => !Number.isInteger(level.n) || level.n < 0 ||
        level.n >= config.SCORED || level.ms <= 0 || level.ms > 60000 ||
        level.lure > 1)) return 'level parameters are out of range.';
    return true;
  }

  const configuration = window.HCCTSettings.applyTaskConfig('nback', defaults, validate);
  window.HCCTNBackConfig = Object.freeze(configuration);
})();
