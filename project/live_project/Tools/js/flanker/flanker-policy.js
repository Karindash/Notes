(function () {
  const config = window.HCCTFlankerConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('Flanker config and task-engine-common must be loaded before flanker-policy.');
  const LEVELS = config.LEVELS;
  const thresholds = config.THRESHOLDS;

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
      timing_invalid: 'Maximum timing drift exceeded ' + thresholds.maxDriftMs + ' ms. The block was discarded as evidence.',
      tab_hidden: 'The tab was hidden during the block, so timing could not be trusted. The block was discarded.',
      high_omissions: 'More than ' + Math.round(thresholds.maxOmissionRate * 100) + '% of scored trials were omitted. Interpret accuracy cautiously.',
      anticipations: 'More than ' + Math.round(thresholds.maxAnticipationRate * 100) +
        '% of responses were faster than ' + thresholds.anticipationMs + ' ms. Some may be anticipatory.',
      stuck_key: 'More than ' + Math.round(thresholds.stuckKeyRate * 100) + '% of responses used one key. Check that both response keys work.',
      timing_drift: 'Mean timing drift exceeded ' + thresholds.meanDriftMs + ' ms. Device timing may affect the results.'
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
    return value >= thresholds.mastered ? 'Mastered' : value >= thresholds.developing ? 'Developing' : 'Not yet';
  }

  function recommend(level, metrics, valid) {
    if (!valid) return {
      text: 'This block could not be counted as evidence (see flags). Try again when timing and attention are reliable.',
      next: level.id
    };
    const accuracy = metrics.primaryAccuracy ?? metrics.accuracy;
    if (accuracy >= thresholds.mastered) {
      return level.id < LEVELS.length
        ? {text: 'Strong accuracy. Next: Level ' + (level.id + 1) + '.', next: level.id + 1}
        : {text: 'Level 10 is designed to be very unlikely to be reliable; repeat it before drawing a conclusion.', next: level.id};
    }
    if (accuracy >= thresholds.developing) return {text: 'Developing accuracy. Repeat this level for more evidence.', next: level.id};
    return level.id > 1
      ? {text: 'Accuracy is below the developing threshold. Try Level ' + (level.id - 1) + '.', next: level.id - 1}
      : {text: 'Accuracy is low at Level 1. Review the response mapping and check your input device.', next: 1};
  }

  window.HCCTFlankerPolicy = Object.freeze({statusPolicy, flagText, suggestedLevel, statusOf, recommend});
})();
