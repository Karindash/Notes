(function () {
  const config = window.HCCTNBackConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('N-back config and task-engine-common must be loaded before nback-policy.');
  const LEVELS = config.LEVELS;
  const MASTER = config.MASTER;
  const DEV = config.DEV;
  const mean = common.mean;

  // ---- Status & recommendation ----

  function statusOf(dprime) {
    return dprime >= MASTER ? 'Mastered' : dprime >= DEV ? 'Developing' : 'Not yet';
  }

  function statusPolicy(levelBlocks) {
    const valid = levelBlocks
      .filter(b => b.valid && b.mode === 'assessment')
      .sort((a, b) => a.ts < b.ts ? -1 : 1);

    if (!valid.length) return { status: 'Unassessed', n: 0 };

    const meanD = mean(valid.slice(-3).map(b => b.dprime));
    return {
      status:  meanD >= MASTER ? 'Mastered' : meanD >= DEV ? 'Developing' : 'Not yet',
      n:       valid.length,
      meanD,
      first:   valid[0].dprime,
      latest:  valid[valid.length - 1].dprime,
      evidence: valid.length >= 3 ? 'Better' : valid.length === 2 ? 'Moderate' : 'Low',
    };
  }

  function levelStats(blocks, levelId) {
    return statusPolicy(blocks.filter(b => b.levelId === levelId));
  }

  function suggestedLevel(blocks) {
    for (const level of LEVELS) {
      if (levelStats(blocks, level.id).status !== 'Mastered') return level.id;
    }
    return LEVELS[LEVELS.length - 1].id;
  }

  function recommend(level, metrics, valid) {
    if (!valid) {
      return {
        text: 'This block could not be counted as evidence (see flags). Nothing here is treated as low ability. Try again when you can focus on this tab.',
        next: level.id,
      };
    }

    const dprime = metrics.dprime;

    if (dprime >= MASTER) {
      return level.id < LEVELS[LEVELS.length - 1].id
        ? { text: `Strong discrimination. Next: Level ${level.id + 1}.`, next: level.id + 1 }
        : { text: `Level ${level.id} is designed to be beyond typical performance. Repeat to confirm: one block at this level is very noisy.`, next: level.id };
    }

    if (dprime >= DEV) {
      return { text: 'Above chance but not yet stable. Repeat this level; more blocks give better evidence.', next: level.id };
    }

    if (level.id > 1) {
      return { text: `Close to chance. Step down to Level ${level.id - 1} to find where performance is reliable.`, next: level.id - 1 };
    }

    return {
      text: 'Close to chance even at Level 1. Check the instructions, your input device and your attention before drawing any conclusion.',
      next: 1,
    };
  }

  window.HCCTNBackPolicy = Object.freeze({statusOf, statusPolicy, levelStats, suggestedLevel, recommend});
})();
