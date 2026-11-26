(function () {
  const config = window.HCCTSeriesConfig;
  const common = window.HCCTTaskEngineCommon;
  const generation = window.HCCTSeriesGeneration;
  if (!config || !common || !generation) throw new Error('Series config, generation, and task-engine-common must be loaded before series-scoring.');
  const SCORED = config.SCORED;
  const maxTimeouts = config.THRESHOLDS.maxTimeouts;
  const levelFor = generation.levelFor;

  function normalizeAnswer(value) {
    if (typeof value === 'number' && Number.isInteger(value)) return String(value);
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (/^[A-Za-z]$/.test(text)) return text.toUpperCase();
    if (/^[+-]?\d+$/.test(text)) return String(Number(text));
    return null;
  }

  function responseKind(response) {
    if (response === null || response === undefined) return {kind: 'timeout'};
    if (typeof response === 'string') {
      const text = response.trim().toLowerCase();
      if (text === 'cnd' || text === "can't be determined" || text === 'cannot be determined') return {kind: 'cnd'};
      return {kind: 'typed', answer: normalizeAnswer(response)};
    }
    if (typeof response !== 'object') return {kind: 'typed', answer: normalizeAnswer(response)};
    if (response.timeout === true || response.timedOut === true) return {kind: 'timeout'};
    if (response.cannotDetermine === true || response.type === 'cnd' || response.type === 'cannotDetermine') return {kind: 'cnd'};
    const answer = response.answer !== undefined ? response.answer : response.value;
    if (typeof answer === 'string' && /^(cnd|can't be determined|cannot be determined)$/i.test(answer.trim())) return {kind: 'cnd'};
    return answer === undefined || answer === null
      ? {kind: 'timeout'}
      : {kind: 'typed', answer: normalizeAnswer(answer), rtMs: response.rtMs !== undefined ? response.rtMs : response.rt};
  }

  function score(level, spec, responses) {
    levelFor(level);
    const items = spec && Array.isArray(spec.items) ? spec.items : [];
    const answers = Array.isArray(responses) ? responses : [];
    const responseTimes = [];
    let correctCount = 0;
    let timeouts = 0;
    let falseDeclines = 0;
    let falseAnswers = 0;
    let cannotDetermineCount = 0;
    const itemResults = items.map((item, index) => {
      const response = responseKind(answers[index]);
      let correct = false;
      if (response.kind === 'timeout') {
        timeouts++;
      } else if (response.kind === 'cnd') {
        cannotDetermineCount++;
        if (!item.solvable) correct = true;
        else falseDeclines++;
      } else if (!item.solvable) {
        falseAnswers++;
      } else if (response.answer !== null && response.answer === normalizeAnswer(item.answer)) {
        correct = true;
      }
      if (correct) {
        correctCount++;
        const rt = response.rtMs;
        if (Number.isFinite(rt) && rt >= 0) responseTimes.push(rt);
      }
      return {index, correct, response: response.kind};
    });
    return {
      correctCount,
      total: items.length,
      accuracy: items.length ? correctCount / items.length : null,
      medianRt: common.median(responseTimes),
      medianRtCorrect: common.median(responseTimes),
      timeouts,
      falseDeclines,
      falseAnswers,
      cannotDetermineCount,
      allCannotDetermine: items.length > 0 && cannotDetermineCount === items.length,
      attempted: items.length - timeouts,
      itemResults
    };
  }

  function validate(metrics, level, timing) {
    levelFor(level);
    const result = metrics || {};
    const flags = [];
    const total = result.total === undefined ? SCORED : result.total;
    const timeouts = result.timeouts || 0;
    let valid = true;
    if (total > 0 && timeouts >= total) {
      valid = false;
      flags.push('all_timeouts');
    }
    if (timing && (timing.hidden === true || timing.hiddenMidItem === true)) {
      valid = false;
      flags.push('hidden');
    }
    if (timeouts > maxTimeouts) flags.push('too_many_timeouts');
    if (result.allCannotDetermine === true ||
        (total > 0 && result.cannotDetermineCount === total)) flags.push('all_cannot_determine');
    return {valid, flags, warning: flags.some(flag => flag !== 'all_timeouts' && flag !== 'hidden')};
  }

  window.HCCTSeriesScoring = Object.freeze({score, validate});
})();
