(function () {
  const COMMON_COLUMNS = [
    'taskId',
    'levelId',
    'seed',
    'valid',
    'flags',
    'primaryMetricName',
    'primaryMetricValue'
  ];
  const NBACK_COLUMNS = [
    'ts',
    'levelId',
    'n',
    'dual',
    'ms',
    'seed',
    'valid',
    'flags',
    'dprime',
    'dLetter',
    'dPos',
    'rt',
    'lureFAs',
    'lureTrials',
    'hz'
  ];

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

  function toJSON(records) {
    return JSON.stringify(records.map(({taskId, block}) => ({...block, taskId})), null, 2);
  }

  function toCSV(records) {
    const columns = COMMON_COLUMNS.concat(NBACK_COLUMNS);
    const quote = value => {
      value = value == null ? '' : String(value);
      return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    };
    const rows = records.map(({taskId, task, block}) => {
      const common = [
        taskId,
        block.levelId,
        block.seed,
        block.valid,
        (block.flags || []).join('|'),
        task.module.profile.metricName,
        metricValue(task, block)
      ];
      const nback = taskId === 'nback'
        ? [
            block.ts,
            block.levelId,
            block.n,
            block.dual,
            block.ms,
            block.seed,
            block.valid,
            (block.flags || []).join('|'),
            block.dprime,
            block.mods && block.mods.letter ? block.mods.letter.d : '',
            block.mods && block.mods.pos ? block.mods.pos.d : '',
            block.rt,
            block.lureFAs,
            block.lureTrials,
            block.device ? block.device.hz : ''
          ]
        : Array(NBACK_COLUMNS.length).fill('');
      return common.concat(nback).map(quote).join(',');
    });
    return [columns.join(',')].concat(rows).join('\n');
  }

  function calibrationStatus(value) {
    if (value == null) return 'Unassessed';
    if (value < 0.8) return 'Cautious';
    if (value > 1.2) return 'Risk-seeking';
    return 'Near-optimal';
  }

  window.HCCTProfileEngine = Object.freeze({
    collectTaskBlocks,
    metricValue,
    toJSON,
    toCSV,
    calibrationStatus
  });
})();
