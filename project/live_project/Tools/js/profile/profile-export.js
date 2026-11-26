(function () {
  const records = window.HCCTProfileRecords;
  if (!records) throw new Error('profile-records must be loaded before profile-export.');
  const metricValue = records.metricValue;
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

  window.HCCTProfileExport = Object.freeze({toJSON, toCSV});
})();
