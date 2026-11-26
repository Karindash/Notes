(function () {
  const defaults = {
    SCORED: 80,
    PRACTICE: 16,
    VOWELS: ['A', 'E', 'I', 'U'],
    CONSONANTS: ['B', 'D', 'F', 'G', 'K', 'M', 'P', 'R', 'S', 'T'],
    DIGITS: [1, 2, 3, 4, 6, 7, 8, 9],
    THRESHOLDS: {
      mastered: 0.9,
      developing: 0.75,
      maxDriftMs: 300,
      maxOmissionRate: 0.25,
      anticipationMs: 150,
      maxAnticipationRate: 0.15,
      stuckKeyRate: 0.9,
      minCorrectPerCondition: 10,
      maxSwitchCostIntervalMs: 150,
      bootstrapRepetitions: 1000
    },
    LEVELS: [
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
    ]
  };
  if (!window.HCCTSettings) throw new Error('settings-store must load before switching-config.');

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
    if (config.LEVELS.some(level => !level.rules.length ||
        level.rules.some(rule => !['P', 'M', 'V'].includes(rule)) ||
        level.responseWindow <= 0 || level.responseWindow > 60000 || level.csi < 0 || level.csi > 60000 ||
        level.switchRate < 0 || level.switchRate > 1)) return 'level parameters are out of range.';
    const validLetters = values => values.length > 0 &&
      new Set(values).size === values.length && values.every(value => /^[A-Z]$/.test(value));
    if (!validLetters(config.VOWELS) || !validLetters(config.CONSONANTS) ||
        config.VOWELS.some(letter => config.CONSONANTS.includes(letter)) ||
        !config.DIGITS.length || new Set(config.DIGITS).size !== config.DIGITS.length ||
        config.DIGITS.some(digit => !Number.isInteger(digit) || digit < 1 || digit > 9 || digit === 5)) {
      return 'stimulus mappings are invalid.';
    }
    if (!Number.isInteger(thresholds.minCorrectPerCondition) || thresholds.minCorrectPerCondition < 1 ||
        !Number.isInteger(thresholds.bootstrapRepetitions) || thresholds.bootstrapRepetitions < 1 ||
        thresholds.bootstrapRepetitions > 10000) {
      return 'reliability settings must be positive integers.';
    }
    return true;
  }

  const configuration = window.HCCTSettings.applyTaskConfig('switching', defaults, validate);
  const LEVELS = Object.freeze(configuration.LEVELS.map(level => Object.freeze(level)));

  function resolveLevel(level) {
    const id = typeof level === 'number' ? level : level && level.id;
    const result = LEVELS.find(item => item.id === id);
    if (!result) throw new RangeError('Unknown switching level: ' + id + '.');
    return result;
  }

  window.HCCTSwitchingConfig = Object.freeze({...configuration, LEVELS, resolveLevel, configuration});
})();
