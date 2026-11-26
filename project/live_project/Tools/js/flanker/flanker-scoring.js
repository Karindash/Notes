(function () {
  const common = window.HCCTTaskEngineCommon;
  const config = window.HCCTFlankerConfig;
  if (!common || !config) throw new Error('Task common and config modules must load before flanker-scoring.');
  const thresholds = config.THRESHOLDS;

  function getResponse(response) {
    if (response == null) return {key: null, rt: null};
    if (typeof response === 'string') return {key: response.toUpperCase(), rt: null};
    const key = response.key ?? response.responseKey ?? response.response ?? response.pressedKey ?? null;
    const rt = response.rtMs ?? response.rt ?? response.reactionTimeMs ?? null;
    return {
      key: typeof key === 'string' ? key.toUpperCase() : key,
      rt: rt != null && Number.isFinite(Number(rt)) ? Number(rt) : null
    };
  }

  function score(level, spec, responses, seed) {
    const included = spec.trials.map((trial, index) => ({trial, response: getResponse(responses && responses[index]), index}))
      .filter(item => spec.mode === 'practice' || item.trial.scored);
    const names = level.id < 3 ? [level.id === 1 ? 'single' : 'neutral'] : ['congruent', 'incongruent'];
    const conditions = {};
    for (const name of names) {
      const items = included.filter(item => item.trial.type === name);
      const correctRts = [];
      let correct = 0;
      let answered = 0;
      for (const item of items) {
        if (item.response.key === 'F' || item.response.key === 'J') {
          answered++;
          if (item.response.key === item.trial.correctKey) {
            correct++;
            if (item.response.rt != null) correctRts.push(item.response.rt);
          }
        }
      }
      conditions[name] = {
        total: items.length,
        correct,
        answered,
        omissions: items.length - answered,
        accuracy: items.length ? correct / items.length : null,
        medianRt: common.median(correctRts),
        correctRts
      };
    }
    const overallCorrect = included.reduce((sum, item) =>
      sum + (item.response.key === item.trial.correctKey ? 1 : 0), 0);
    const total = included.length;
    const totalResponses = included.reduce((sum, item) =>
      sum + (item.response.key === 'F' || item.response.key === 'J' ? 1 : 0), 0);
    const responseKeys = included.map(item => item.response.key).filter(key => key === 'F' || key === 'J');
    const anticipationCount = included.filter(item =>
      (item.response.key === 'F' || item.response.key === 'J') &&
      item.response.rt != null && item.response.rt < thresholds.anticipationMs
    ).length;
    const overallAccuracy = total ? overallCorrect / total : null;
    const primaryAccuracy = level.id < 3
      ? overallAccuracy
      : conditions.incongruent.accuracy;
    let interferenceCost;
    let reliability;
    if (level.id < 3) {
      interferenceCost = {available: false, reason: 'unavailable', estimate: null, lower: null, upper: null};
      reliability = {status: 'unavailable', reliable: null, reasons: []};
    } else {
      const congruent = conditions.congruent.correctRts;
      const incongruent = conditions.incongruent.correctRts;
      const interval = common.bootstrapMedianDifference(incongruent, congruent, seed, 1000);
      const reasons = [];
      if (!interval) reasons.push('insufficient_correct_responses');
      if (interval && interval.upper - interval.lower > thresholds.maxInterferenceIntervalMs) reasons.push('wide_interval');
      if (conditions.congruent.correct < thresholds.minCorrectPerCondition ||
          conditions.incongruent.correct < thresholds.minCorrectPerCondition) {
        reasons.push('fewer_than_10_correct_per_condition');
      }
      interferenceCost = interval
        ? {available: true, estimate: interval.estimate, lower: interval.lower, upper: interval.upper}
        : {available: false, reason: 'insufficient_correct_responses', estimate: null, lower: null, upper: null};
      reliability = {status: reasons.length ? 'unreliable' : 'reliable', reliable: reasons.length === 0, reasons};
      if (interferenceCost.available) interferenceCost.unreliable = reasons.length > 0;
    }
    return {
      levelId: level.id,
      conditions,
      total,
      totalResponses,
      omissions: total - totalResponses,
      omissionRate: total ? (total - totalResponses) / total : 0,
      anticipationCount,
      anticipationRate: totalResponses ? anticipationCount / totalResponses : 0,
      responseKeys,
      overallAccuracy,
      primaryAccuracy,
      accuracy: primaryAccuracy,
      interferenceCost,
      reliability
    };
  }

  function validate(metrics, level, timing) {
    const flags = [];
    const responses = metrics.totalResponses || 0;
    const total = metrics.total || 0;
    const keyCounts = {F: 0, J: 0};
    for (const key of metrics.responseKeys || []) if (keyCounts[key] != null) keyCounts[key]++;
    const maxDrift = timing && (timing.max ?? timing.maxDriftMs);
    const meanDrift = timing && (timing.mean ?? timing.meanDriftMs);

    if (responses === 0) flags.push('no_responses');
    if (timing && Number.isFinite(Number(maxDrift)) && Number(maxDrift) > thresholds.maxDriftMs) flags.push('timing_invalid');
    if (timing && (timing.hidden || timing.tabHidden)) flags.push('tab_hidden');
    if (total && metrics.omissionRate > thresholds.maxOmissionRate) flags.push('high_omissions');
    if (responses && metrics.anticipationRate > thresholds.maxAnticipationRate) flags.push('anticipations');
    if (responses && Math.max(keyCounts.F, keyCounts.J) / responses > thresholds.stuckKeyRate) flags.push('stuck_key');
    if (timing && Number.isFinite(Number(meanDrift)) && Number(meanDrift) > thresholds.meanDriftMs) flags.push('timing_drift');
    return {
      valid: !flags.includes('no_responses') && !flags.includes('timing_invalid') && !flags.includes('tab_hidden'),
      flags
    };
  }

  window.HCCTFlankerScoring = Object.freeze({score, validate});
})();
