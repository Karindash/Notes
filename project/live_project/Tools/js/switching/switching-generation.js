(function () {
  const config = window.HCCTSwitchingConfig;
  const common = window.HCCTTaskEngineCommon;
  if (!config || !common) throw new Error('Switching config and task-engine-common must be loaded before switching-generation.');
  const {SCORED, PRACTICE, VOWELS, CONSONANTS, DIGITS} = config;
  const resolveLevel = config.resolveLevel;

  function cueSequence(level, count, random) {
    const item = resolveLevel(level);
    const cues = item.rules;
    if (cues.length === 1) return new Array(count).fill(cues[0]);
    if (item.id === 3) return Array.from({length: count}, (_, index) => cues[Math.floor(index / 2) % 2]);
    if (cues.length === 3 && item.switchRate === 1) {
      const cycle = common.shuffle(cues.slice(), random);
      return Array.from({length: count}, (_, index) => cycle[index % cycle.length]);
    }
    if (cues.length === 3 && item.switchRate > 0 && item.switchRate < 1) {
      const base = Math.floor(count / cues.length);
      const extra = count % cues.length;
      const targetSwitches = Math.round((count - 1) * item.switchRate);
      for (let attempt = 0; attempt < 500; attempt++) {
        const extraCues = new Set(common.shuffle(cues.slice(), random).slice(0, extra));
        const balanced = [];
        cues.forEach(cue => {
          const cueCount = base + (extraCues.has(cue) ? 1 : 0);
          for (let index = 0; index < cueCount; index++) balanced.push(cue);
        });
        common.shuffle(balanced, random);
        let transitions = 0;
        for (let index = 1; index < balanced.length; index++) {
          if (balanced[index] !== balanced[index - 1]) transitions++;
        }
        if (transitions === targetSwitches) return balanced;
      }
    }

    const switches = Math.min(count - 1, Math.round((count - 1) * item.switchRate));
    const positions = common.shuffle(Array.from({length: count - 1}, (_, index) => index + 1), random)
      .slice(0, switches);
    const switchSet = new Set(positions);
    const sequence = [cues[Math.floor(random() * cues.length)]];
    const counts = Object.fromEntries(cues.map(cue => [cue, 1]));
    for (let index = 1; index < count; index++) {
      const current = sequence[index - 1];
      if (!switchSet.has(index)) {
        sequence.push(current);
        counts[current]++;
        continue;
      }
      const choices = cues.filter(cue => cue !== current);
      const fewest = Math.min(...choices.map(cue => counts[cue]));
      const balancedChoices = choices.filter(cue => counts[cue] === fewest);
      const next = balancedChoices[Math.floor(random() * balancedChoices.length)];
      sequence.push(next);
      counts[next]++;
    }
    return sequence;
  }

  function correctKey(rule, digit, letter, level) {
    const id = resolveLevel(level).id;
    if (rule === 'P') return digit % 2 === 1 ? 'F' : 'J';
    if (rule === 'M') {
      if (id === 10) return digit > 5 ? 'F' : 'J';
      return digit < 5 ? 'F' : 'J';
    }
    if (rule === 'V') {
      const vowel = VOWELS.includes(letter);
      if (id === 10) return vowel ? 'J' : 'F';
      return vowel ? 'F' : 'J';
    }
    return null;
  }

  function congruent(digit, letter, level) {
    const item = resolveLevel(level);
    const mappings = item.rules.map(rule => correctKey(rule, digit, letter, item));
    return mappings.every(key => key === mappings[0]);
  }

  function makeStimuli(item, cue, previousDigit, lastKey, keyRun, desiredCongruent, random) {
    let candidates = [];
    for (const digit of DIGITS) {
      if (digit === previousDigit) continue;
      const letters = item.rules.includes('V') ? VOWELS.concat(CONSONANTS) : [null];
      for (const letter of letters) {
        const key = correctKey(cue, digit, letter, item);
        if (keyRun >= 4 && key === lastKey) continue;
        candidates.push({digit, letter, key, congruent: congruent(digit, letter, item)});
      }
    }
    if (!candidates.length) {
      for (const digit of DIGITS) {
        const letters = item.rules.includes('V') ? VOWELS.concat(CONSONANTS) : [null];
        for (const letter of letters) candidates.push({digit, letter, key: correctKey(cue, digit, letter, item), congruent: congruent(digit, letter, item)});
      }
    }
    if (keyRun >= 4) {
      const alternateKeys = candidates.filter(candidate => candidate.key !== lastKey);
      if (alternateKeys.length) candidates = alternateKeys;
    }
    const targetCongruency = candidates.filter(candidate => candidate.congruent === desiredCongruent);
    if (targetCongruency.length) candidates = targetCongruency;
    const selected = candidates[Math.floor(random() * candidates.length)];
    return selected;
  }

  function generate(level, seed, mode) {
    const item = resolveLevel(level);
    const trialMode = mode === 'practice' ? 'practice' : 'assessment';
    const count = trialMode === 'practice' ? PRACTICE : SCORED;
    const random = common.rng(seed);
    const cues = cueSequence(item, count, random);
    const congruencyPattern = common.shuffle(
      Array.from({length: count}, (_, index) => index < Math.floor(count / 2)),
      random
    );
    const trials = [];
    let previousDigit = null;
    let lastKey = null;
    let keyRun = 0;
    for (let index = 0; index < count; index++) {
      const cue = cues[index];
      const stimulus = makeStimuli(item, cue, previousDigit, lastKey, keyRun, congruencyPattern[index], random);
      const switched = index > 0 && cue !== cues[index - 1];
      const repeated = index > 0 && !switched;
      const trial = {
        index,
        cue,
        rule: cue,
        digit: stimulus.digit,
        letter: stimulus.letter,
        stimulus: stimulus.letter ? stimulus.letter + stimulus.digit : String(stimulus.digit),
        correctKey: stimulus.key,
        switched,
        repeated,
        switch: switched,
        congruent: stimulus.congruent,
        csi: item.csi,
        cueFlash: item.cueFlash || 0,
        responseWindow: item.responseWindow,
        mode: trialMode
      };
      trials.push(trial);
      previousDigit = stimulus.digit;
      keyRun = stimulus.key === lastKey ? keyRun + 1 : 1;
      lastKey = stimulus.key;
    }
    return {
      levelId: item.id,
      seed,
      mode: trialMode,
      totalTrials: count,
      scoredTrials: SCORED,
      practiceTrials: PRACTICE,
      csi: item.csi,
      cueFlash: item.cueFlash || 0,
      responseWindow: item.responseWindow,
      trials
    };
  }

  window.HCCTSwitchingGeneration = Object.freeze({generate, correctKey});
})();
