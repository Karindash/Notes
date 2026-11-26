(function () {
  const config = window.HCCTSwitchingConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('Switching config and task-engine-common must be loaded before switching-scoring.');
  const resolveLevel = config.resolveLevel;
  const thresholds = config.THRESHOLDS;

  function responseKey(response) {
    if (response == null) return null;
    if (typeof response === 'string') return response.toUpperCase();
    const key = response.key != null ? response.key : response.response;
    return key == null ? null : String(key).toUpperCase();
  }

  function responseRt(response) {
    if (!response || typeof response !== 'object') return null;
    const value = response.rt != null ? response.rt : response.rtMs;
    return Number.isFinite(value) ? value : null;
  }

  function score(level, spec, responses, seed, baselineBlocks) {
    const item = resolveLevel(level);
    const trials = spec && Array.isArray(spec.trials) ? spec.trials : [];
    const answers = Array.isArray(responses) ? responses : [];
    let correct = 0;
    let omissions = 0;
    let responseCount = 0;
    const correctRts = [];
    const switchRts = [];
    const repeatRts = [];
    let switchCorrect = 0;
    let repeatCorrect = 0;
    const ruleRepeatRts = {};
    const keyCounts = {F: 0, J: 0};
    let anticipations = 0;
    for (let index = 0; index < trials.length; index++) {
      const trial = trials[index];
      const answer = answers[index];
      const key = responseKey(answer);
      const rt = responseRt(answer);
      if (key !== null) {
        responseCount++;
        if (keyCounts[key] != null) keyCounts[key]++;
        if (rt !== null && rt < thresholds.anticipationMs) anticipations++;
      }
      if (key === null) {
        omissions++;
        continue;
      }
      if (key !== trial.correctKey) continue;
      correct++;
      if (trial.switched) switchCorrect++;
      if (trial.repeated) repeatCorrect++;
      if (rt !== null) {
        correctRts.push(rt);
        if (trial.switched) {
          switchRts.push(rt);
        } else if (trial.repeated) {
          repeatRts.push(rt);
          if (!ruleRepeatRts[trial.rule]) ruleRepeatRts[trial.rule] = [];
          ruleRepeatRts[trial.rule].push(rt);
        }
      }
    }

    const accuracy = trials.length ? correct / trials.length : null;
    const switchDifference = common.bootstrapMedianDifference(
      switchRts, repeatRts, seed, thresholds.bootstrapRepetitions
    );
    const switchCost = switchDifference ? {
      estimate: switchDifference.estimate,
      lower: switchDifference.lower,
      upper: switchDifference.upper,
      ci: {lower: switchDifference.lower, upper: switchDifference.upper},
      width: switchDifference.upper - switchDifference.lower,
      reliable: switchCorrect >= thresholds.minCorrectPerCondition &&
        repeatCorrect >= thresholds.minCorrectPerCondition &&
        switchDifference.upper - switchDifference.lower <= thresholds.maxSwitchCostIntervalMs,
      label: switchCorrect < thresholds.minCorrectPerCondition ||
        repeatCorrect < thresholds.minCorrectPerCondition ||
        switchDifference.upper - switchDifference.lower > thresholds.maxSwitchCostIntervalMs ? 'unreliable' : 'reliable',
      switchCorrect,
      repeatCorrect,
      switchRtCount: switchRts.length,
      repeatRtCount: repeatRts.length
    } : 'unavailable';

    const baselineByRule = {};
    (baselineBlocks || []).forEach(block => {
      if (!block || block.valid !== true) return;
      if (block.mode && block.mode !== 'assessment') return;
      const levelId = block.levelId != null ? block.levelId : block.level;
      if (Number(levelId) !== 1 && Number(levelId) !== 2) return;
      const rule = Number(levelId) === 1 ? 'P' : 'M';
      const rt = block.medianRt != null ? block.medianRt :
        block.rt != null ? block.rt :
          block.metrics && (block.metrics.medianRt != null ? block.metrics.medianRt : block.metrics.rt);
      if (Number.isFinite(rt)) baselineByRule[rule] = rt;
    });
    const mixingCostByRule = {};
    Object.keys(ruleRepeatRts).forEach(rule => {
      if (Number.isFinite(baselineByRule[rule])) {
        mixingCostByRule[rule] = common.median(ruleRepeatRts[rule]) - baselineByRule[rule];
      }
    });
    const mixingRules = Object.keys(mixingCostByRule);
    const mixingCost = mixingRules.length
      ? common.median(mixingRules.map(rule => mixingCostByRule[rule]))
      : 'needs a baseline';

    const validResponseRts = answers.map(responseRt).filter(rt => rt !== null);
    const sameKeyRate = responseCount ? Math.max(keyCounts.F, keyCounts.J) / responseCount : 0;
    return {
      levelId: item.id,
      total: trials.length,
      correct,
      accuracy,
      omissions,
      omissionRate: trials.length ? omissions / trials.length : 0,
      responseCount,
      medianRt: common.median(correctRts),
      rt: common.median(correctRts),
      switchCost,
      mixingCost,
      mixingCostByRule,
      switchCorrect,
      repeatCorrect,
      keyCounts,
      stuckKeyRate: sameKeyRate,
      anticipationCount: anticipations,
      anticipationRate: responseCount ? anticipations / responseCount : 0,
      timing: {
        max: spec && spec.timing ? spec.timing.max : undefined,
        tabHidden: !!(spec && spec.timing && (spec.timing.tabHidden || spec.timing.hidden))
      },
      validResponseRtCount: validResponseRts.length
    };
  }

  function validate(metrics, level, timing) {
    const item = resolveLevel(level);
    const flags = [];
    let valid = true;
    const total = metrics && Number.isFinite(metrics.total) ? metrics.total : 0;
    const responses = metrics && Number.isFinite(metrics.responseCount) ? metrics.responseCount : 0;
    const omissions = metrics && Number.isFinite(metrics.omissions) ? metrics.omissions : total - responses;
    const omissionRate = metrics && Number.isFinite(metrics.omissionRate)
      ? metrics.omissionRate : total ? omissions / total : 0;
    const anticipationRate = metrics && Number.isFinite(metrics.anticipationRate) ? metrics.anticipationRate : 0;
    const stuckKeyRate = metrics && Number.isFinite(metrics.stuckKeyRate) ? metrics.stuckKeyRate : 0;
    const timingInfo = timing || (metrics && metrics.timing) || {};

    if (!responses) {
      valid = false;
      flags.push('no_responses');
    }
    if (timingInfo.max > thresholds.maxDriftMs || timingInfo.tabHidden || timingInfo.hidden || timingInfo.visibility === 'hidden') {
      valid = false;
      flags.push('timing_invalid');
    }
    if (omissionRate > thresholds.maxOmissionRate) flags.push('omissions');
    if (anticipationRate > thresholds.maxAnticipationRate) flags.push('anticipations');
    if (stuckKeyRate > thresholds.stuckKeyRate) flags.push('stuck_key');
    if (item.id >= 3 && item.id <= 10) {
      if ((metrics.switchCorrect || 0) < thresholds.minCorrectPerCondition) flags.push('few_switch_correct');
      if ((metrics.repeatCorrect || 0) < thresholds.minCorrectPerCondition) flags.push('few_repeat_correct');
    }
    return {valid, flags};
  }

  window.HCCTSwitchingScoring = Object.freeze({score, validate});
})();
