(function () {
  function collectTaskBlocks(registry, getBlocks) {
    return registry.flatMap(task =>
      getBlocks(task.id).map(block => ({taskId: task.id, task, block}))
    );
  }

  function metricValue(task, block) {
    const key = task.module.profile.metricKey;
    if (block.metrics && block.metrics[key] != null) return block.metrics[key];
    return block[key] == null ? '' : block[key];
  }

  function calibrationStatus(value) {
    if (value == null) return 'Unassessed';
    if (value < 0.8) return 'Cautious';
    if (value > 1.2) return 'Risk-seeking';
    return 'Near-optimal';
  }

  window.HCCTProfileRecords = Object.freeze({collectTaskBlocks, metricValue, calibrationStatus});
})();
