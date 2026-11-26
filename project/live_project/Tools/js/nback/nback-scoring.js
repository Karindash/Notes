(function () {
  const common = window.HCCTTaskEngineCommon;
  const config = window.HCCTNBackConfig;
  const generation = window.HCCTNBackGeneration;
  if (!common || !config || !generation) throw new Error('Task common, config, and generation modules must load before nback-scoring.');
  const mean = common.mean;
  const isTarget = generation.isTarget;
  const timingThresholds = config.VALIDATION;

  // ---- Probit function (rational approximation) ----

  function probit(p) {
    // Coefficients for the rational approximation.
    const a = [
      -3.969683028665376e+01,  2.209460984245205e+02,
      -2.759285104469687e+02,  1.383577518672690e+02,
      -3.066479806614716e+01,  2.506628277459239e+00,
    ];
    const b = [
      -5.447609879822406e+01,  1.615858368580409e+02,
      -1.556989798598866e+02,  6.680131188771972e+01,
      -1.328068155288572e+01,
    ];
    const c = [
      -7.784894002430293e-03, -3.223964580411365e-01,
      -2.400758277161838e+00, -2.549732539343734e+00,
       4.374664141464968e+00,  2.938163982698783e+00,
    ];
    const d = [
       7.784695709041462e-03,  3.224671290700398e-01,
       2.445134137142996e+00,  3.754408661907416e+00,
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
             ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
    }

    if (p <= pHigh) {
      const q = p - 0.5;
      const r = q * q;
      return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
             (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
    }

    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
             ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }

  // ---- Signal detection theory (log-linear correction to avoid ±∞ at 0%/100%) ----

  function sdt(hits, targets, falseAlarms, nonTargets) {
    const hitRate  = (hits + 0.5) / (targets + 1);
    const farRate  = (falseAlarms + 0.5) / (nonTargets + 1);
    const zH = probit(hitRate);
    const zF = probit(farRate);
    return { d: zH - zF, c: -(zH + zF) / 2 };
  }

  /**
   * Score a completed block.
   * @param {object} level - Level definition object.
   * @param {object} seq   - Generated sequence from genSequence().
   * @param {Array}  resp  - Array of {letter: rtMs|null, pos: rtMs|null} per trial.
   */
  function score(level, seq, resp) {
    const channels = level.dual ? ['letter', 'pos'] : ['letter'];
    const result = { mods: {}, lureTrials: 0, lureFAs: 0, totalResp: 0 };
    const channelDprimes = [];
    const allCorrectRts  = [];

    for (const channel of channels) {
      let hits = 0, misses = 0, falseAlarms = 0, correctRejects = 0;
      let targets = 0, nonTargets = 0;
      const correctRts = [];

      for (let i = seq.n; i < seq.N; i++) {
        const isT  = isTarget(seq, i, channel);
        const rt   = resp[i] && resp[i][channel] != null ? resp[i][channel] : null;
        const lure = seq[channel].kinds[i] === 'L';

        if (rt != null) result.totalResp++;

        if (isT) {
          targets++;
          if (rt != null) { hits++; correctRts.push(rt); }
          else              misses++;
        } else {
          nonTargets++;
          if (lure) result.lureTrials++;
          if (rt != null) {
            falseAlarms++;
            if (lure) result.lureFAs++;
          } else {
            correctRejects++;
          }
        }
      }

      const sdtResult = sdt(hits, targets, falseAlarms, nonTargets);
      result.mods[channel] = {
        targets, nonTargets, hits, misses,
        fas: falseAlarms, crs: correctRejects,
        hr:  hits / targets,
        far: falseAlarms / nonTargets,
        d:   sdtResult.d,
        c:   sdtResult.c,
        rt:  mean(correctRts),
      };
      channelDprimes.push(sdtResult.d);
      allCorrectRts.push(...correctRts);
    }

    result.dprime = mean(channelDprimes);
    result.rt     = mean(allCorrectRts);
    return result;
  }

  // ---- Validation ----

  function validate(metrics, level, timing) {
    const flags = [];
    let valid = true;

    if (metrics.totalResp === 0) {
      valid = false;
      flags.push('no_responses');
    }

    if (timing && timing.max > timingThresholds.maxDriftMs) {
      valid = false;
      flags.push('timing_invalid');
    } else if (timing && (timing.mean > timingThresholds.warningMeanDriftMs ||
        timing.max > timingThresholds.warningMaxDriftMs)) {
      flags.push('timing_warning');
    }

    for (const channel in metrics.mods) {
      const mod = metrics.mods[channel];
      if (mod.far >= 0.7 && mod.hr >= 0.7)                        flags.push('press_all_' + channel);
      if (level.dual && mod.hits + mod.fas === 0 && metrics.totalResp > 0) flags.push('ignored_' + channel);
    }

    return { valid, flags };
  }

  function flagText(flag) {
    if (flag === 'no_responses')
      return 'No responses were made, so this block cannot be scored. It is not counted as low ability.';
    if (flag === 'timing_invalid')
      return 'The browser delayed stimulus timing by more than ' + timingThresholds.maxDriftMs +
        ' ms (background tab or heavy load). Block discarded as evidence.';
    if (flag === 'timing_warning')
      return 'Timing was somewhat unstable on this device. d′ is still usable; reaction times are less reliable.';
    if (flag.indexOf('press_all_') === 0) {
      const channel = flag.slice(10) === 'pos' ? 'position' : 'letter';
      return `Almost everything was answered as a match on the ${channel} channel. d′ then reflects no discrimination.`;
    }
    if (flag.indexOf('ignored_') === 0) {
      const channel = flag.slice(8) === 'pos' ? 'position' : 'letter';
      return `The ${channel} channel received no responses, which pulls the dual-task score down.`;
    }
    return flag;
  }

  window.HCCTNBackScoring = Object.freeze({score, validate, flagText});
})();
