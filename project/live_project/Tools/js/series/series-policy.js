(function () {
  const config = window.HCCTSeriesConfig;
  const common = window.HCCTTaskEngineCommon;
  const generation = window.HCCTSeriesGeneration;
  if (!config || !common || !generation) throw new Error('Series config, generation, and task-engine-common must be loaded before series-policy.');
  const LEVELS = config.LEVELS;
  const levelFor = generation.levelFor;
  const thresholds = config.THRESHOLDS;

  function statusOf(value) {
    return value >= thresholds.mastered ? 'Mastered' :
      value >= thresholds.developing ? 'Developing' : 'Not yet';
  }

  function statusPolicy(blocks) {
    const valid = (blocks || []).filter(block => block.valid && block.mode === 'assessment')
      .slice()
      .sort((left, right) => String(left.ts || '').localeCompare(String(right.ts || '')));
    if (!valid.length) return {status: 'Unassessed', n: 0};
    const scored = valid.map(block => {
      const value = block.correctCount !== undefined && block.correctCount !== null
        ? block.correctCount
        : block.metrics && block.metrics.correctCount;
      return {block, value};
    }).filter(entry => Number.isFinite(entry.value));
    if (!scored.length) return {status: 'Unassessed', n: 0};
    const lastThree = scored.slice(-3);
    const meanCorrect = common.mean(lastThree.map(entry => entry.value));
    if (meanCorrect === null) return {status: 'Unassessed', n: 0};
    return {
      status: statusOf(meanCorrect),
      n: scored.length,
      meanCorrect,
      meanValue: meanCorrect,
      first: scored[0].value,
      latest: scored[scored.length - 1].value,
      evidence: common.evidence(scored.length)
    };
  }

  function suggestedLevel(blocks) {
    const history = blocks || [];
    for (const level of LEVELS) {
      const levelBlocks = history.filter(block => block.levelId === level.id);
      if (statusPolicy(levelBlocks).status !== 'Mastered') return level.id;
    }
    return LEVELS[LEVELS.length - 1].id;
  }

  function recommend(level, metrics, valid) {
    const selected = levelFor(level);
    if (!valid) return {text: 'This block cannot be counted as evidence. Try again when the tab is visible and you can complete the items.', next: selected.id};
    const count = metrics.correctCount;
    if (count >= thresholds.mastered) {
      return selected.id < LEVELS.length
        ? {text: 'Strong performance on this rough single-block hint. Next: Level ' + (selected.id + 1) + '.', next: selected.id + 1}
        : {text: 'Level 10 also probes noticing when a problem is underdetermined. Repeat to confirm this rough single-block hint.', next: selected.id};
    }
    if (count >= thresholds.developing) return {text: 'Developing performance. Repeat this level; a single block is a rough hint.', next: selected.id};
    return {text: selected.id > 1 ? 'Try Level ' + (selected.id - 1) + ' to find a more comfortable level.' : 'Review the instructions and try another Level 1 block.', next: Math.max(1, selected.id - 1)};
  }

  window.HCCTSeriesPolicy = Object.freeze({statusOf, statusPolicy, suggestedLevel, recommend});
})();
