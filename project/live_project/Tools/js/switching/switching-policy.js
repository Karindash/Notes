(function () {
  const config = window.HCCTSwitchingConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('Switching config and task-engine-common must be loaded before switching-policy.');
  const LEVELS = config.LEVELS;
  const resolveLevel = config.resolveLevel;
  const thresholds = config.THRESHOLDS;

  function statusOf(value) {
    if (value == null || !Number.isFinite(Number(value))) return 'Unassessed';
    const accuracy = Number(value);
    return accuracy >= thresholds.mastered ? 'Mastered' :
      accuracy >= thresholds.developing ? 'Developing' : 'Not yet';
  }

  function statusPolicy(blocks) {
    const valid = (blocks || []).map((block, index) => ({block, index}))
      .filter(entry => entry.block && entry.block.valid && entry.block.mode === 'assessment' &&
        Number.isFinite(entry.block.accuracy))
      .sort((left, right) => {
        const a = left.block.ts;
        const b = right.block.ts;
        if (a == null || b == null) return left.index - right.index;
        return a < b ? -1 : a > b ? 1 : left.index - right.index;
      });
    if (!valid.length) return {status: 'Unassessed', n: 0};
    const recent = valid.slice(-3).map(entry => entry.block.accuracy);
    const meanAccuracy = common.mean(recent);
    return {
      status: statusOf(meanAccuracy),
      n: valid.length,
      meanAccuracy,
      meanValue: meanAccuracy,
      first: valid[0].block.accuracy,
      latest: valid[valid.length - 1].block.accuracy,
      evidence: common.evidence(valid.length)
    };
  }

  function suggestedLevel(blocks) {
    for (const item of LEVELS) {
      const result = statusPolicy((blocks || []).filter(block => block.levelId === item.id));
      if (result.status !== 'Mastered') return item.id;
    }
    return LEVELS.length;
  }

  function flagText(flag) {
    const descriptions = {
      no_responses: 'No responses were made, so this block cannot be scored.',
      timing_invalid: 'Timing drift exceeded ' + thresholds.maxDriftMs + ' ms or the tab was hidden; discard this block as evidence.',
      omissions: 'More than ' + Math.round(thresholds.maxOmissionRate * 100) + '% of trials were omitted. Omissions count as errors.',
      anticipations: 'More than ' + Math.round(thresholds.maxAnticipationRate * 100) +
        '% of responses were made before ' + thresholds.anticipationMs + ' ms.',
      stuck_key: 'More than ' + Math.round(thresholds.stuckKeyRate * 100) + '% of responses used the same key.',
      few_switch_correct: 'Fewer than ' + thresholds.minCorrectPerCondition + ' correct switch trials; switch cost is not reliable.',
      few_repeat_correct: 'Fewer than ' + thresholds.minCorrectPerCondition + ' correct repeat trials; switch cost is not reliable.'
    };
    return descriptions[flag] || flag;
  }

  function recommend(level, metrics, valid) {
    const item = resolveLevel(level);
    if (!valid) return {text: 'This block could not be counted as evidence (see flags). Try again when timing and attention are stable.', next: item.id};
    const accuracy = metrics && metrics.accuracy;
    if (accuracy >= thresholds.mastered) {
      return item.id < LEVELS.length
        ? {text: 'Mastered this level. Next: Level ' + (item.id + 1) + '.', next: item.id + 1}
        : {text: 'Level 10 is very unlikely to be performed accurately. Repeat to confirm this result.', next: item.id};
    }
    if (accuracy >= thresholds.developing) return {text: 'Developing at this level. Repeat it to confirm performance.', next: item.id};
    return item.id > 1
      ? {text: 'Accuracy is below the developing threshold. Try Level ' + (item.id - 1) + '.', next: item.id - 1}
      : {text: 'Accuracy is below the developing threshold at Level 1. Review the instructions and input device.', next: item.id};
  }

  window.HCCTSwitchingPolicy = Object.freeze({statusOf, statusPolicy, suggestedLevel, flagText, recommend});
})();
