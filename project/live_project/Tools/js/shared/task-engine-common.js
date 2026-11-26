(function () {
  const random = window.HCCTTaskRandom;
  const statistics = window.HCCTTaskStatistics;
  if (!random || !statistics) throw new Error('Task random and statistics modules must be loaded before task-engine-common.');

  window.HCCTTaskEngineCommon = Object.freeze({
    rng: random.rng,
    shuffle: random.shuffle,
    mean: statistics.mean,
    median: statistics.median,
    bootstrapMedianDifference: statistics.bootstrapMedianDifference,
    evidence: statistics.evidence
  });
})();
