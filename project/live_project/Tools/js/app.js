/* ============================================================
   HCCT app.js — UI coordinator and block runner
   ============================================================

   Naming conventions:
     qs(selector)    — document.querySelector shorthand
     qsa(selector)   — document.querySelectorAll shorthand
     nbackState      — state object for the running n-back block (or null)
     blockState      — state object for the running generic block  (or null)

   Two parallel block state machines are maintained:
     • N-back  (nbackState) — handled by startBlock / runTrial / finishBlock
     • Generic (blockState) — handles Flanker, Switching, Series
       via startGenericBlock / showGenericTrial / finishGenericBlock
   ============================================================ */

// ---- Module aliases ----

const {
  LETTERS,
  MATCH_P,
  INPUT_KEYS,
  SCORED,
  nameOf,
  mean,
  isTarget,
} = window.HCCTNBackEngine;

const taskRegistry  = window.HCCTTaskRegistry;
const profileEngine = window.HCCTProfileEngine;
const settings = window.HCCTSettings;

// ---- Global state ----

let selectedTaskId = settings.getDefaultTaskId(taskRegistry);
let curLevel = settings.getDefaultLevel(
  selectedTaskId,
  taskRegistry.find(task => task.id === selectedTaskId).module.levels
);
let nbackState = null;   // running n-back block, or null
let blockState = null;   // running generic block, or null

const DEV_INFO = { hz: null };

// ---- DOM helpers ----

const qs  = selector => document.querySelector(selector);
const qsa = selector => [...document.querySelectorAll(selector)];

// ---- Refresh-rate measurement (used for frame-accurate exposures) ----

function measureHz() {
  return new Promise(resolve => {
    let frameCount = 0;
    let t0 = null;
    function frame(t) {
      if (t0 === null) t0 = t;
      frameCount++;
      if (frameCount >= 40) {
        resolve(Math.round(1000 / ((t - t0) / (frameCount - 1))));
      } else {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
    setTimeout(() => resolve(null), 2500);
  });
}

measureHz().then(hz => { DEV_INFO.hz = hz; });

// ---- Task helpers ----

function getTask(taskId = selectedTaskId) {
  return taskRegistry.find(task => task.id === taskId);
}

function selectTask(taskId) {
  const task = getTask(taskId);
  if (!task) { console.error(`Task is not registered: ${taskId}`); return false; }
  if ((nbackState && !nbackState.done) || (blockState && !blockState.done)) {
    abortBlock('You changed tasks.');
  }
  selectedTaskId = task.id;
  qs('#taskSelector').value = task.id;
  curLevel = settings.getDefaultLevel(task.id, task.module.levels);
  nbackState = null;
  blockState = null;
  renderLab();
  return true;
}

// ---- Storage ----

const ls = {
  get(key, defaultValue) {
    try { const v = localStorage.getItem(key); return v == null ? defaultValue : v; }
    catch (e) { return defaultValue; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  },
};

function taskStore(taskId) {
  const storageKey = `hcct-${taskId}-blocks`;
  return {
    get() {
      try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
      catch (e) { return []; }
    },
    set(value) { return ls.set(storageKey, JSON.stringify(value)); },
  };
}

function allTaskBlocks() {
  return profileEngine.collectTaskBlocks(taskRegistry, id => taskStore(id).get());
}

// ---- Status badge CSS class ----

const stCls = (status, policyType = getTask().module.policyType) =>
  policyType === 'calibration' ? 'calibration'
  : ({ Mastered: 'mastered', Developing: 'developing', 'Not yet': 'notyet' }[status] || '');

// ---- Phase 1 workspace ----

const CORE_GROUPS = [
  ['Perception',          'Receiving and discriminating information from sensory input.',          'Visual recognition, auditory recognition, spatial awareness'],
  ['Attention',           'Selecting, sustaining, and shifting processing resources.',             'Selective, sustained, divided attention'],
  ['Memory',              'Encoding, retaining, and retrieving information.',                      'Working, episodic, semantic, procedural memory'],
  ['Information Processing', 'Transforming, integrating, and representing information.',           'Abstraction, information integration, cognitive speed'],
  ['Reasoning',           'Drawing and evaluating inferences from available information.',         'Deductive, inductive, analogical, causal reasoning'],
  ['Decision Making',     'Evaluating alternatives and selecting a course of action.',             'Risk assessment, prioritization, resource allocation'],
  ['Execution',           'Translating intentions into controlled actions.',                       'Coordination, precision, response speed, sequencing'],
  ['Adaptation',          'Adjusting behavior or strategy as conditions change.',                  'Error correction, flexibility, transfer learning'],
];

const ADDITIONAL_GROUPS = ['Learning', 'Prediction', 'Simulation', 'Inhibition', 'Metacognition', 'Association'];

const reviewed = new Set(JSON.parse(ls.get('hcct-reviewed', '[]')));

// Populate task selector once on load.
taskRegistry.forEach(task => {
  const option = document.createElement('option');
  option.value = task.id;
  option.textContent = task.name;
  qs('#taskSelector').appendChild(option);
});
qs('#taskSelector').value = selectedTaskId;
qs('#taskSelector').addEventListener('change', e => selectTask(e.target.value));

// ---- Phase 1 rendering ----

function render() {
  qs('#coreCards').innerHTML = CORE_GROUPS
    .map((group, i) => `
      <article class="card">
        <div class="num">0${i + 1}</div>
        <h3>${group[0]}</h3>
        <p>${group[1]}</p>
      </article>`)
    .join('');

  qs('#operationList').innerHTML = CORE_GROUPS
    .map((group, i) => `
      <label class="operation">
        <input type="checkbox" data-review="${i}" ${reviewed.has(i) ? 'checked' : ''}>
        <span>
          <strong>${group[0]}</strong>
          <small>${group[1]} Examples: ${group[2]}.</small>
        </span>
        <span class="tag">${reviewed.has(i) ? 'Reviewed' : 'Candidate'}</span>
      </label>`)
    .join('');

  qs('#additionalList').innerHTML = ADDITIONAL_GROUPS
    .map(group => `
      <div class="question">
        <b>${group}</b>
        <p>Classify as primitive, cross-cutting function, composite process, or unresolved.</p>
      </div>`)
    .join('');

  updateProgress();
}

function updateProgress() {
  const count = reviewed.size;
  qs('#progressText').textContent = `${count} of 8 reviewed`;
  qs('#progressBar').style.width  = (count / 8 * 100) + '%';
}

document.addEventListener('change', e => {
  if (e.target.matches('[data-review]')) {
    const index = Number(e.target.dataset.review);
    e.target.checked ? reviewed.add(index) : reviewed.delete(index);
    ls.set('hcct-reviewed', JSON.stringify([...reviewed]));
    render();
  }
  if (e.target.matches('[data-deliverable]')) {
    const vals = JSON.parse(ls.get('hcct-deliverables', '{}'));
    vals[e.target.dataset.deliverable] = e.target.checked;
    ls.set('hcct-deliverables', JSON.stringify(vals));
  }
  if (e.target.id === 'foundationChoice') ls.set('hcct-foundation', e.target.value);
});

function restore() {
  qs('#primitiveRule').value    = ls.get('hcct-rule', '');
  qs('#reviewNotes').value      = ls.get('hcct-notes', '');
  qs('#foundationChoice').value = ls.get('hcct-foundation', '');
  const vals = JSON.parse(ls.get('hcct-deliverables', '{}'));
  qsa('[data-deliverable]').forEach(el => { el.checked = !!vals[el.dataset.deliverable]; });
}

qs('#saveReview').addEventListener('click', () => {
  ls.set('hcct-rule', qs('#primitiveRule').value);
  ls.set('hcct-notes', qs('#reviewNotes').value);
  qs('#saveStatus').textContent = 'Saved locally in this browser.';
});

function exportText() {
  const lines = [
    '# HCCT — Phase 1 Review', '',
    `Reviewed core groups: ${reviewed.size}/8`, '',
    '## Primitive inclusion criterion',
    qs('#primitiveRule').value || '_Not defined_', '',
    '## Foundational position',
    qs('#foundationChoice').value || '_Undecided_', '',
    '## Review notes',
    qs('#reviewNotes').value || '_No notes yet_', '',
    '## Core group status',
    ...CORE_GROUPS.map((group, i) => `- [${reviewed.has(i) ? 'x' : ' '}] ${group[0]} — ${group[1]}`), '',
    '## Phase 1 deliverables',
    ...qsa('[data-deliverable]').map(el =>
      `- [${el.checked ? 'x' : ' '}] ${el.parentElement.querySelector('strong').textContent}`),
  ];
  return lines.join('\n');
}

function download(filename, data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

qs('#exportReview').addEventListener('click', () =>
  download('HCCT-Phase-1-Review.md', exportText(), 'text/markdown'));

qs('#downloadNotes').addEventListener('click', () =>
  download(
    'HCCT-About-and-Phase-1.md',
    [
      '# Human Cognitive Capability Taxonomy (HCCT)', '',
      '## About',
      'An exploratory framework for mapping the capabilities humans use to perceive, process, remember, reason, decide, act, learn, and adapt.', '',
      '## Working definition',
      'Human cognitive capability is the set of mental and behavioral capabilities through which a person receives and interprets stimuli, transforms information, evaluates situations, makes decisions, executes actions, learns, and adapts.', '',
      '## Phase 1 — Primitive review',
      'Review these candidate groups:',
      ...CORE_GROUPS.map(g => `- **${g[0]}** — ${g[1]} Examples: ${g[2]}.`), '',
      `Additional functions to classify: ${ADDITIONAL_GROUPS.join(', ')}.`, '',
      '## Lab',
      'v0.2 adds a 12-level n-back ladder (working memory) scored with d-prime.', '',
      '## Methodological note',
      'HCCT is conceptual and exploratory. It is not a validated psychological test.',
    ].join('\n'),
    'text/markdown'));

// ---- Navigation ----

function showPage(name) {
  if (((nbackState && !nbackState.done) || (blockState && !blockState.done)) && name !== 'lab') {
    abortBlock('You left the Lab page.');
  }
  qsa('.page').forEach(p => p.classList.toggle('active', p.id === name));
  qsa('.nav').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'registry') renderTaskRegistry();
  if (name === 'lab')      renderLab();
  if (name === 'profile')  renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

qsa('[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
qsa('[data-go]').forEach(b   => b.addEventListener('click', () => showPage(b.dataset.go)));

// ---- Task registry page ----

function renderTaskRegistry() {
  qs('#registryCount').textContent =
    `${taskRegistry.length} registered ${taskRegistry.length === 1 ? 'task' : 'tasks'}`;

  qs('#taskRegistryList').innerHTML = taskRegistry.map(task => {
    const meta = task.module.meta;
    return `
      <article class="card registry-card">
        <div class="registry-card-head">
          <span class="tag">${task.id}</span>
          <span class="st calibration">Registered</span>
        </div>
        <div class="eyebrow">${meta.groups.join(' · ')}</div>
        <h2>${task.name}</h2>
        <p>${meta.construct}</p>
        <div class="registry-facts">
          <div><small>Difficulty levels</small><strong>${task.module.levels.length}</strong></div>
          <div><small>Primary metric</small><strong>${meta.primaryMetric}</strong></div>
          <div><small>Difficulty axis</small><strong>${meta.difficultyAxis}</strong></div>
          <div><small>Stimuli</small><strong>${meta.stimuli}</strong></div>
        </div>
        <div class="footer-actions">
          <button class="btn primary" type="button" data-open-task="${task.id}">Open in Lab</button>
        </div>
      </article>`;
  }).join('');
}

// ================================================================
//  Lab — shared helpers
// ================================================================

const N_BACK_GRID_CELLS = [0, 1, 2, 3, 5, 6, 7, 8];

function renderTaskCard(task) {
  const m = task.module.meta;
  qs('#taskCard').innerHTML = `
    <article class="card">
      <div class="eyebrow">${m.groups.join(' · ')}</div>
      <h2>${m.name}</h2>
      <p><strong>Construct:</strong> ${m.construct}</p>
      <p><strong>Procedure:</strong> ${m.procedure}</p>
      <p><strong>Stimuli:</strong> ${m.stimuli}</p>
      <p><strong>Primary metric:</strong> ${m.primaryMetric} · <strong>Difficulty:</strong> ${m.difficultyAxis}</p>
      <div class="notice">
        <b>Confounds</b>
        <ul>${m.confounds.map(x => `<li>${x}</li>`).join('')}</ul>
        <b>Validity rules</b>
        <ul>${m.validityRules.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
    </article>`;
}

function renderLab() {
  const task    = getTask();
  const module  = task.module;
  const levels  = module.levels;
  const blocks  = taskStore(task.id).get();

  if (module.id !== 'nback') {
    qs('#labPageEyebrow').textContent        = `Lab / ${task.name} · ${module.meta.groups.join(' · ')}`;
    qs('#labHeading').textContent            = task.name;
    qs('#labIntroduction').textContent       = module.meta.procedure;
    qs('[data-lab-nav-label]').textContent   = `Lab · ${task.name}`;
  } else {
    qs('#labPageEyebrow').textContent        = 'Lab / Task 01 · Working memory';
    qs('#labHeading').textContent            = 'N-back ladder';
    qs('#labIntroduction').textContent       = 'One task, twelve levels, from the easiest measurable setting to one that is designed to be beyond typical human performance. Pick a level, practise with feedback, then run a recorded block.';
    qs('[data-lab-nav-label]').textContent   = 'Lab · N-back ladder';
  }

  const suggested  = module.suggestedLevel(blocks);
  const levelStats = levels.map(l => module.statusPolicy(blocks.filter(b => b.levelId === l.id)));
  const masteredCount = levelStats.filter(s => s.status === 'Mastered').length;

  qs('#labProgText').textContent    = `${masteredCount} of ${levels.length} mastered`;
  qs('#labProgBar').style.width     = (masteredCount / levels.length * 100) + '%';

  renderTaskCard(task);

  const running = (nbackState && !nbackState.done) || (blockState && !blockState.done);
  qs('#ladder').classList.toggle('locked', !!running);

  qs('#ladder').innerHTML = levels.map((level, i) => {
    const detail = module.id === 'nback'
      ? `${level.tier} · ${(level.ms / 1000).toFixed(1)}s per item${level.lure ? ` · lures ${Math.round(level.lure * 100)}%` : ''}`
      : module.levelSummary(level);
    return `
      <div class="lv ${level.id === curLevel ? 'sel' : ''}"
           data-level="${level.id}" data-tier="${level.tier}"
           role="button" tabindex="0">
        <b>L${level.id}</b>
        <span class="lvmain">
          <strong>${module.nameOf(level)}${level.id === suggested ? ' ▶' : ''}</strong>
          <small>${detail}</small>
        </span>
        <span class="st ${stCls(levelStats[i].status, module.policyType)}">${levelStats[i].status}</span>
      </div>`;
  }).join('');

  qs('#linkList').innerHTML = module.links.map(link => `
    <div class="link ${link.kind === 'confound' ? 'conf' : ''}">
      <span class="w">${link.weight}<br><small>${link.kind}</small></span>
      <div>
        <strong>${link.capability}</strong>
        <span>${link.note}</span>
      </div>
    </div>`).join('');

  if (!running && !((nbackState && nbackState.showingResult) || (blockState && blockState.showingResult))) {
    renderIdle();
  }
}

// ================================================================
//  Lab — idle state (level selected, no block running)
// ================================================================

function renderIdle() {
  const module = getTask().module;
  const level  = module.levels[curLevel - 1];
  if (module.id !== 'nback') return renderGenericIdle(module, level);

  // N-back idle card.
  qs('#labCard').innerHTML = `
    <div class="eyebrow">Level ${level.id} · ${level.tier}</div>
    <h2>${module.nameOf(level)}</h2>
    <p>${module.ruleText(level)}</p>
    <div class="metrics">
      <div class="metric"><small>Memory load</small><b>${level.n === 0 ? 'Target only' : level.n + ' back'}</b></div>
      <div class="metric"><small>Pace</small><b>${(level.ms / 1000).toFixed(1)} s / item</b></div>
      <div class="metric"><small>Channels</small><b>${level.dual ? 'Letter + position' : 'Letter'}</b></div>
      <div class="metric"><small>Lure rate</small><b>${level.lure ? Math.round(level.lure * 100) + '%' : 'None'}</b></div>
      <div class="metric"><small>Scored trials</small><b>${SCORED}${level.n ? ` (+${level.n} warm-up)` : ''}</b></div>
      <div class="metric"><small>Targets</small><b>~${Math.round(MATCH_P * 100)}% per channel</b></div>
    </div>
    ${level.tier === 'Impossible' ? `
      <div class="flag">Level 12 is designed to sit beyond typical unaided human performance, so it can reveal your ceiling. It is not a pass mark, and "impossible" here means very unlikely, not proven impossible.</div>` : ''}
    <div class="footer-actions">
      <button class="btn" data-act="practice">Practice · with feedback</button>
      <button class="btn primary" data-act="assess">Start recorded block</button>
    </div>
    <p class="empty">Use a keyboard if you can. Stay on this tab, as switching away cancels the block. Practice is never recorded.</p>`;
}

function renderGenericIdle(module, level) {
  const scored = module.SCORED || module.SCORED_TRIALS || level.scoredTrials
    || level.itemCount || level.trialCount
    || (module.modeCounts || {}).assessment || module.scoredTrials || module.itemsPerBlock || '';
  const practice = module.PRACTICE || module.PRACTICE_TRIALS || level.practiceCount
    || (module.modeCounts || {}).practice || '';
  const countLabel = scored
    ? `${scored} scored${practice ? ` (+${practice} practice)` : ''}`
    : 'See level rules';
  const duration = level.timeLimitMs || level.responseWindowMs || level.responseWindow
    || level.windowMs || level.ms || (level.timeSeconds && level.timeSeconds * 1000);

  let warningFlag = '';
  if (module.id === 'flanker' && level.id >= 6) {
    warningFlag = `<div class="flag">Very short exposures depend on the display refresh rate. Level 10 is designed to be very unlikely to be reliable.</div>`;
  } else if (module.id === 'series' && level.id === 10) {
    warningFlag = `<div class="flag">This level also probes whether you notice when a problem cannot be resolved, not only reasoning. A single block is a rough hint.</div>`;
  }

  qs('#labCard').innerHTML = `
    <div class="eyebrow">Level ${level.id} · ${level.tier}</div>
    <h2>${module.nameOf(level)}</h2>
    <p>${module.ruleText(level)}</p>
    <div class="metrics">
      <div class="metric"><small>Items per block</small><b>${countLabel}</b></div>
      <div class="metric"><small>Time per item</small><b>${duration ? `${Math.round(duration / 1000)} s` : 'Self-paced'}</b></div>
      <div class="metric"><small>Primary metric</small><b>${module.profile.metricName}</b></div>
    </div>
    ${warningFlag}
    <div class="footer-actions">
      <button class="btn" data-act="practice">Practice · not recorded</button>
      <button class="btn primary" data-act="assess">Start recorded block</button>
    </div>
    <p class="empty">Practice provides feedback and is never saved. Recorded blocks store their seed and timing evidence in this browser.</p>`;
}

// ================================================================
//  N-back block runner
// ================================================================

function startBlock(mode) {
  if (getTask().module.id !== 'nback') return startGenericBlock(mode);
  if (nbackState && !nbackState.done) return;

  const module = getTask().module;
  const level  = module.levels[curLevel - 1];
  const seed   = (Math.random() * 4294967296) >>> 0;
  const seq    = module.generate(level, seed, mode);

  nbackState = {
    level, mode, seq,
    trialIndex:  -1,
    onsets:      [],
    responses:   Array.from({ length: seq.N }, () => ({ letter: null, pos: null })),
    drifts:      [],
    seed,
    t0:          0,
    timer:       null,
    hideTimer:   null,
    done:        false,
  };

  renderNBackRunning();
  renderLab();
  countdown(3);
}

function renderNBackRunning() {
  const level = nbackState.level;
  const cells = [...Array(9).keys()]
    .map(i => `<div class="cell ${i === 4 ? 'center' : ''}" data-cell="${i}"></div>`)
    .join('');

  qs('#labCard').innerHTML = `
    <div class="runhead">
      <span class="tag">${nbackState.mode === 'practice' ? 'PRACTICE · feedback on · not recorded' : 'RECORDED · no feedback'}</span>
      <span id="trialText" class="progress-label">Get ready</span>
    </div>
    <div class="stage">
      <div class="targetbox">${level.n === 0
        ? `Target letter <b>${LETTERS[nbackState.seq.letter.target]}</b>`
        : `Compare with <b>${level.n}</b> back`}</div>
      <div class="nb-grid ${level.dual ? '' : 'single'}">${cells}</div>
      <div class="resp">
        ${level.dual ? `<button class="rbtn" data-resp="pos">Position match<small>${INPUT_KEYS.position.toUpperCase()}</small></button>` : ''}
        <button class="rbtn" data-resp="letter">Letter match<small>${INPUT_KEYS.letter.toUpperCase()}${level.dual ? '' : ' / Space'}</small></button>
      </div>
      <div id="runMsg" class="empty"></div>
      <button class="btn" data-act="abort">Stop block</button>
    </div>`;
}

function setMessage(text) {
  const el = qs('#runMsg');
  if (el) el.textContent = text;
}

function countdown(count) {
  if (!nbackState || nbackState.done) return;
  if (count === 0) {
    nbackState.t0 = performance.now() + 60;
    nbackState.timer = setTimeout(() => runTrial(0), 60);
    return;
  }
  setMessage(`Starting in ${count}…`);
  nbackState.timer = setTimeout(() => countdown(count - 1), 1000);
}

function nbackFeedbackText(trialIndex) {
  const missed = [];
  const channels = nbackState.level.dual ? ['letter', 'pos'] : ['letter'];
  for (const channel of channels) {
    const isT = getTask().module.isTarget(nbackState.seq, trialIndex, channel);
    if (isT && nbackState.responses[trialIndex][channel] == null) {
      missed.push('Missed a ' + (channel === 'pos' ? 'position' : 'letter') + ' match');
    }
  }
  return missed.join(' · ');
}

function runTrial(trialIndex) {
  if (!nbackState || nbackState.done) return;
  if (trialIndex >= nbackState.seq.N) return getTask().module.ui.finish();

  const feedbackText = nbackState.mode === 'practice' && trialIndex > 0
    ? nbackFeedbackText(trialIndex - 1) : '';

  const now = performance.now();
  nbackState.trialIndex = trialIndex;
  nbackState.onsets[trialIndex] = now;
  nbackState.drifts.push(Math.abs(now - (nbackState.t0 + trialIndex * nbackState.level.ms)));

  qsa('.rbtn').forEach(b => b.classList.remove('pressed', 'ok', 'bad'));
  showNBackStim(trialIndex);
  setMessage(feedbackText);

  const trialText = qs('#trialText');
  if (trialText) trialText.textContent = `Trial ${trialIndex + 1} / ${nbackState.seq.N}`;

  nbackState.hideTimer = setTimeout(hideNBackStim, getTask().module.stimMs(nbackState.level));
  nbackState.timer     = setTimeout(
    () => runTrial(trialIndex + 1),
    Math.max(0, nbackState.t0 + (trialIndex + 1) * nbackState.level.ms - performance.now())
  );
}

function showNBackStim(trialIndex) {
  hideNBackStim();
  const trial   = nbackState.seq.trials[trialIndex];
  const cellIdx = nbackState.level.dual ? N_BACK_GRID_CELLS[trial.pos] : 4;
  const cell    = qs(`[data-cell="${cellIdx}"]`);
  if (cell) { cell.textContent = trial.letter; cell.classList.add('on'); }
}

function hideNBackStim() {
  qsa('.cell').forEach(cell => { cell.textContent = ''; cell.classList.remove('on'); });
}

function respond(channel) {
  if (!nbackState || nbackState.done) return;
  if (nbackState.trialIndex < 0 || nbackState.trialIndex >= nbackState.seq.N) return;
  if (channel === 'pos' && !nbackState.level.dual) return;

  const responseSlot = nbackState.responses[nbackState.trialIndex];
  if (responseSlot[channel] != null) return;  // already responded this trial

  responseSlot[channel] = performance.now() - nbackState.onsets[nbackState.trialIndex];

  const btn = qs(`[data-resp="${channel}"]`);
  if (btn) {
    btn.classList.add('pressed');
    if (nbackState.mode === 'practice') {
      const correct = isTarget(nbackState.seq, nbackState.trialIndex, channel);
      if (correct !== null) {
        btn.classList.remove('pressed');
        btn.classList.add(correct ? 'ok' : 'bad');
      }
    }
  }
}

function finishBlock() {
  clearTimers();
  nbackState.done = true;
  nbackState.showingResult = true;

  const module  = getTask().module;
  const level   = nbackState.level;
  const metrics = module.score(level, nbackState.seq, nbackState.responses);

  if (nbackState.mode === 'practice') {
    renderNBackResult(metrics, { level, practice: true, valid: true, flags: [] });
    renderLab();
    return;
  }

  const timing = {
    mean: mean(nbackState.drifts),
    max:  Math.max(...nbackState.drifts),
  };
  const validity = module.validate(metrics, level, timing);

  const record = {
    id:         Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ts:         new Date().toISOString(),
    levelId:    level.id,
    n:          level.n,
    dual:       level.dual,
    ms:         level.ms,
    mode:       'assessment',
    seed:       nbackState.seed,
    scored:     SCORED,
    valid:      validity.valid,
    flags:      validity.flags,
    dprime:     metrics.dprime,
    rt:         metrics.rt,
    mods:       metrics.mods,
    lureTrials: metrics.lureTrials,
    lureFAs:    metrics.lureFAs,
    timing,
    device: {
      hz:    DEV_INFO.hz,
      dpr:   window.devicePixelRatio,
      w:     innerWidth,
      h:     innerHeight,
      touch: 'ontouchstart' in window,
      ua:    navigator.userAgent.slice(0, 140),
    },
  };

  const store = taskStore(getTask().id);
  const all   = store.get();
  all.push(record);
  const saved = store.set(all);

  renderNBackResult(metrics, { level, practice: false, valid: validity.valid, flags: validity.flags, saved });
  renderLab();
}

function renderNBackResult(metrics, info) {
  const module = getTask().module;
  const level  = info.level;
  const rec    = module.recommend(level, metrics, info.valid);
  const status = info.valid ? module.statusOf(metrics.dprime) : 'Not scored';

  nbackState.nextLevel = info.practice ? level.id : rec.next;

  const modCards = Object.keys(metrics.mods).map(channel => {
    const m = metrics.mods[channel];
    return `
      <div class="metric">
        <small>${channel === 'pos' ? 'Position' : 'Letter'} · hits / false alarms</small>
        <b>${m.hits}/${m.targets} · ${m.fas}/${m.nonTargets}</b>
        <small>d′ ${m.d.toFixed(2)}${m.rt ? ` · ${Math.round(m.rt)} ms` : ''}</small>
      </div>`;
  }).join('');

  qs('#labCard').innerHTML = `
    <div class="eyebrow">
      ${info.practice ? 'Practice result · not recorded' : 'Block result · recorded'}
      · Level ${level.id} ${nameOf(level)}
    </div>
    <div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;margin:10px 0">
      <div>
        <small class="progress-label">d′ (sensitivity)</small>
        <div class="big">${info.valid ? metrics.dprime.toFixed(2) : '—'}</div>
      </div>
      <span class="st ${stCls(status)}">${status}</span>
    </div>
    <div class="metrics">
      ${modCards}
      <div class="metric"><small>Lure false alarms</small><b>${level.lure ? metrics.lureFAs + ' / ' + metrics.lureTrials : 'n/a'}</b></div>
    </div>
    ${info.flags.map(f => `<div class="flag">${module.flagText(f)}</div>`).join('')}
    <p>${info.practice
      ? 'Practice scores are not stored. When you are ready, start a recorded block.'
      : rec.text}</p>
    ${info.saved === false ? `<div class="flag">Browser storage was unavailable, so this block could not be saved.</div>` : ''}
    <p class="empty">d′ of about 0 means chance, 1 means some real discrimination, 2 or more means strong discrimination. A block has only about ${Math.round(MATCH_P * SCORED)} targets per channel, so expect roughly ±0.5 of noise.</p>
    <div class="footer-actions">
      <button class="btn primary" data-act="again">${info.practice ? 'Back to level' : 'Run another block'}</button>
      ${!info.practice && rec.next !== level.id ? `<button class="btn" data-act="next">Go to Level ${rec.next}</button>` : ''}
      <button class="btn" data-go-profile="1">View profile</button>
    </div>`;
}

function abortBlock(reason) {
  if (blockState && !blockState.done) return abortGenericBlock(reason);
  if (!nbackState || nbackState.done) return;

  clearTimers();
  nbackState.done = true;
  nbackState.showingResult = true;

  const el = qs('#labCard');
  if (el) {
    el.innerHTML = `
      <div class="eyebrow">Block not recorded</div>
      <h2>Stopped</h2>
      <p>${reason || 'You stopped the block.'} Nothing was saved and nothing was counted as low ability.</p>
      <div class="footer-actions">
        <button class="btn primary" data-act="again">Back to level ${curLevel}</button>
      </div>`;
  }
  renderLab();
}

// ================================================================
//  Generic block runner  (Flanker, Switching, Series)
// ================================================================

function genericItems(spec) {
  return spec.trials || spec.items || [];
}

function genericWindow(level) {
  return level.responseWindowMs || level.responseWindow || level.windowMs
    || level.timeLimitMs || level.ms
    || (level.timeSeconds && level.timeSeconds * 1000)
    || 30000;
}

function genericItemText(item) {
  if (item.stimulusText) return item.stimulusText;
  if (item.display)     return item.display;
  if (item.digit != null && item.letter != null) return `${item.digit}   ${item.letter}`;
  if (item.string)      return item.string;
  if (item.text)        return item.text;
  if (item.stimulus && typeof item.stimulus === 'object') {
    const { digit, letter } = item.stimulus;
    if (digit != null && letter != null) return `${digit}   ${letter}`;
  }
  if (item.stimulus != null) return String(item.stimulus);
  return '';
}

function genericCueText(item) {
  return item.cue || item.rule || item.ruleLetter || '';
}

function renderGenericRunning() {
  const task     = getTask();
  const module   = task.module;
  const practice = blockState.mode === 'practice';

  const controls = module.id === 'series'
    ? `<form id="seriesAnswerForm" class="series-answer-form">
         <label for="seriesAnswer">Your answer</label>
         <input id="seriesAnswer" type="text" inputmode="text" autocomplete="off" aria-label="Next term">
         <button class="btn primary" type="submit" data-task-submit>Submit answer</button>
         <button class="btn" type="button" data-task-undetermined>Can't be determined</button>
       </form>`
    : `<div class="resp" id="taskControls" ${module.id === 'switching' ? 'hidden' : ''}>
         <button class="rbtn" type="button" data-task-response="F">Left <small>F</small></button>
         <button class="rbtn" type="button" data-task-response="J">Right <small>J</small></button>
       </div>`;

  const taskVisual = module.id === 'series'
    ? `<div class="targetbox" id="seriesCountdown" role="timer"></div>
       <div class="series-terms" id="seriesTerms"></div>`
    : `${module.id === 'switching' ? `<div class="targetbox" id="genericCue"></div>` : ''}
       <div class="task-stimulus" id="genericStimulus" aria-live="off"></div>`;

  qs('#labCard').innerHTML = `
    <div class="runhead">
      <span class="tag">${practice ? 'PRACTICE · feedback on · not recorded' : 'RECORDED · no feedback'}</span>
      <span id="genericTrialText" class="progress-label"></span>
    </div>
    <div class="stage generic-stage">
      ${taskVisual}
      ${controls}
      <div id="genericMessage" class="empty" aria-live="polite"></div>
      <button class="btn" type="button" data-act="abort">Stop block</button>
    </div>`;
}

function startGenericBlock(mode) {
  if (blockState && !blockState.done) return;

  const task  = getTask();
  const module = task.module;
  const level  = module.levels[curLevel - 1];
  const seed   = (Math.random() * 4294967296) >>> 0;
  const spec   = module.generate(level, seed, mode);
  const items  = genericItems(spec);

  if (!items.length) throw new Error(`${task.name} generated an empty block.`);

  blockState = {
    taskId:            task.id,
    module,
    level,
    spec,
    seed,
    mode,
    items,
    index:             -1,
    responses:         Array(items.length).fill(null),
    completed:         Array(items.length).fill(false),
    drifts:            [],
    frameCounts:       Array(items.length).fill(null),
    onset:             null,
    ready:             false,
    done:              false,
    timer:             null,
    hideTimer:         null,
    maskTimer:         null,
    cueTimer:          null,
    countdownTimer:    null,
    countdownInterval: null,
    frameRequest:      null,
  };

  renderGenericRunning();
  renderLab();
  scheduleGenericNext(Number(items[0].jitterMs) || 0);
}

function scheduledGenericCallback(delay, callback) {
  const target = performance.now() + Math.max(0, delay);
  blockState.timer = setTimeout(() => {
    if (!blockState || blockState.done) return;
    blockState.drifts.push(Math.abs(performance.now() - target));
    callback();
  }, Math.max(0, delay));
}

function scheduleGenericNext(delay) {
  if (!blockState || blockState.done) return;
  const nextIndex = blockState.index + 1;
  if (nextIndex >= blockState.items.length) return finishGenericBlock();
  scheduledGenericCallback(delay, () => showGenericTrial(nextIndex));
}

function showGenericTrial(index) {
  if (!blockState || blockState.done) return;

  blockState.index  = index;
  blockState.ready  = false;
  blockState.onset  = null;

  const item   = blockState.items[index];
  const module = blockState.module;
  const level  = blockState.level;

  const counter = qs('#genericTrialText');
  if (counter) counter.textContent = `Item ${index + 1} / ${blockState.items.length}`;

  const message = qs('#genericMessage');
  if (message) message.textContent = '';

  // Series: show terms and start countdown timer.
  if (module.id === 'series') {
    const termsEl = qs('#seriesTerms');
    const inputEl = qs('#seriesAnswer');
    if (termsEl) termsEl.textContent = `${item.shownTerms.join(', ')}, ?`;
    if (inputEl) { inputEl.value = ''; inputEl.focus(); }
    blockState.onset = performance.now();
    blockState.ready = true;
    beginGenericCountdown(genericWindow(level));
    return;
  }

  // Switching: show cue, then delay before showing stimulus.
  if (module.id === 'switching') {
    const csi = level.csiMs != null ? level.csiMs : Number(level.csi) || 0;
    const cueEl = qs('#genericCue');
    if (cueEl) cueEl.textContent = genericCueText(item);

    if (csi > 0 && level.id !== 10) {
      const stimulusEl = qs('#genericStimulus');
      if (stimulusEl) stimulusEl.textContent = '';
      blockState.cueTarget = performance.now() + csi;
      blockState.cueTimer  = setTimeout(() => {
        if (!blockState || blockState.done) return;
        blockState.drifts.push(Math.abs(performance.now() - (blockState.cueTarget || performance.now())));
        revealGenericStimulus(item);
      }, csi);
      return;
    }

    revealGenericStimulus(item);
    if (level.id === 10) {
      blockState.cueTimer = setTimeout(() => { if (cueEl) cueEl.textContent = ''; }, 80);
    }
    return;
  }

  revealGenericStimulus(item);
}

function revealGenericStimulus(item) {
  if (!blockState || blockState.done) return;

  const stimulusEl = qs('#genericStimulus');
  if (stimulusEl) stimulusEl.textContent = genericItemText(item);

  blockState.onset = performance.now();
  blockState.ready = true;

  const controlsEl = qs('#taskControls');
  if (controlsEl) controlsEl.hidden = false;

  const exposure = blockState.level.exposureMs != null
    ? blockState.level.exposureMs
    : blockState.level.exposure;

  if (exposure && exposure > 0) {
    if (exposure < 100) {
      // Frame-counted hide: use rAF instead of a timeout for sub-100ms exposures.
      const frames = blockState.level.exposureIsFrame ? 1
        : blockState.level.exposureFrames
          || blockState.items[blockState.index].exposureFrames
          || Math.max(1, Math.round((DEV_INFO.hz || 60) * exposure / 1000));

      blockState.frameCounts[blockState.index] = 0;
      let shownFrames = 0;

      const hideAfterFrame = () => {
        if (!blockState || blockState.done) return;
        shownFrames++;
        blockState.frameCounts[blockState.index] = shownFrames;
        if (shownFrames >= frames) maskGenericStimulus(item);
        else blockState.frameRequest = requestAnimationFrame(hideAfterFrame);
      };
      blockState.frameRequest = requestAnimationFrame(hideAfterFrame);
    } else {
      blockState.hideTimer = setTimeout(() => maskGenericStimulus(item), exposure);
    }
  }

  const deadline = blockState.onset + genericWindow(blockState.level);
  blockState.timer = setTimeout(() => {
    blockState.drifts.push(Math.abs(performance.now() - deadline));
    completeGenericTrial(null);
  }, genericWindow(blockState.level));
}

function maskGenericStimulus(item) {
  if (!blockState || blockState.done) return;
  const stimulusEl = qs('#genericStimulus');
  const maskText   = item.mask || item.maskString || '';
  if (stimulusEl) stimulusEl.textContent = maskText;

  const maskDuration = blockState.level.maskMs || blockState.level.maskDurationMs || 0;
  if (maskDuration) {
    blockState.maskTimer = setTimeout(() => { if (stimulusEl) stimulusEl.textContent = ''; }, maskDuration);
  } else if (stimulusEl) {
    stimulusEl.textContent = '';
  }
}

function beginGenericCountdown(duration) {
  const endTime = blockState.onset + duration;

  const update = () => {
    if (!blockState || blockState.done) return;
    const remaining = Math.max(0, endTime - performance.now());
    const seconds   = Math.ceil(remaining / 1000);
    const displayEl = qs('#seriesCountdown');
    if (displayEl) displayEl.textContent = `00:${String(seconds).padStart(2, '0')}`;
    if (remaining <= 0) {
      blockState.drifts.push(Math.abs(performance.now() - endTime));
      completeGenericTrial(null);
      return;
    }
    blockState.countdownTimer = setTimeout(update, Math.min(250, remaining));
  };

  update();
  blockState.timer = setTimeout(() => {
    blockState.drifts.push(Math.abs(performance.now() - endTime));
    completeGenericTrial(null);
  }, duration);
}

function genericResponseIsCorrect(item, response, module) {
  if (module.id === 'series') {
    if (item.underdetermined || item.isUnderdetermined || item.solvable === false) {
      return response.cannotDetermine;
    }
    return item.solvable !== false
      && !response.cannotDetermine
      && String(response.answer).trim().toUpperCase() === String(item.answer).trim().toUpperCase();
  }
  return response.key === item.correctKey;
}

function submitGenericResponse(key) {
  if (!blockState || blockState.done || !blockState.ready || blockState.completed[blockState.index]) return;

  const response = blockState.module.id === 'series'
    ? { answer: key.answer, cannotDetermine: !!key.cannotDetermine, rt: performance.now() - blockState.onset }
    : { key, rt: performance.now() - blockState.onset };

  completeGenericTrial(response);
}

function completeGenericTrial(response) {
  if (!blockState || blockState.done || blockState.completed[blockState.index]) return;

  const state = blockState;
  const item  = state.items[state.index];

  // Cancel all pending timers for this trial.
  clearTimeout(state.timer);
  clearTimeout(state.hideTimer);
  clearTimeout(state.maskTimer);
  clearTimeout(state.cueTimer);
  clearTimeout(state.countdownTimer);
  if (state.countdownInterval) clearInterval(state.countdownInterval);

  state.completed[state.index] = true;
  state.ready = false;
  state.responses[state.index] = response;

  if (state.mode === 'practice') {
    const messageEl = qs('#genericMessage');
    if (messageEl) {
      messageEl.textContent = response
        ? (genericResponseIsCorrect(item, response, state.module) ? 'Correct.' : 'Not quite.')
        : 'Time is up for this item.';
    }
  }

  const nextIndex = state.index + 1;
  if (nextIndex >= state.items.length) return finishGenericBlock();

  const isSeriesTask   = state.module.id === 'series';
  const baseDelay      = isSeriesTask ? 350 : Number(state.items[nextIndex].jitterMs) || 0;
  const feedbackDelay  = state.mode === 'practice' && !isSeriesTask ? 300 : 0;

  scheduledGenericCallback(feedbackDelay + baseDelay, () => showGenericTrial(nextIndex));
}

// ---- Format a metric value as text ----

function genericMetricValue(module, metrics) {
  const key = module.profile.metricKey;
  if (metrics[key] != null) return metrics[key];
  if (metrics.primaryMetricValue != null) return metrics.primaryMetricValue;
  return null;
}

function genericMetricText(value, key) {
  if (value == null) return '—';
  if (typeof value !== 'number') return String(value);
  if (/accuracy/i.test(key))  return `${Math.round(value * 100)}%`;
  if (/rt|cost/i.test(key))   return `${Math.round(value)} ms`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function genericResultCards(module, metrics, level) {
  // Flatten nested condition RTs for Flanker.
  if (module.id === 'flanker') {
    const conditions = metrics.conditions || {};
    const congruent  = conditions.congruent || {};
    const incongruent = conditions.incongruent || {};
    metrics = {
      ...metrics,
      congruentMedianRt:   metrics.congruentMedianRt   || congruent.medianRt,
      incongruentMedianRt: metrics.incongruentMedianRt || incongruent.medianRt,
    };
  }

  const fieldsByTask = {
    flanker: [
      ['Overall accuracy',      metrics.overallAccuracy],
      ['Congruent median RT',   metrics.congruentMedianRt],
      ['Incongruent median RT', metrics.incongruentMedianRt],
      ['Interference cost',     metrics.interferenceCost],
    ],
    switching: [
      ['Median RT',    metrics.medianRt],
      ['Switch cost',  metrics.switchCost],
      ['Mixing cost',  metrics.mixingCost],
    ],
    series: [
      ['Correct items', metrics.correctCount],
      ['Median time',   metrics.medianRt],
      ['Timeouts',      metrics.timeouts],
      ...(level.id === 10 ? [
        ['False declines', metrics.falseDeclines],
        ['False answers',  metrics.falseAnswers],
      ] : []),
    ],
  };

  const fields = fieldsByTask[module.id] || [];

  return fields.map(([label, value]) => {
    if (value && typeof value === 'object') {
      const estimate = value.estimate == null ? null : value.estimate;

      const intervalText = value.lower == null ? ''
        : `<small>95% interval ${Math.round(value.lower)} to ${Math.round(value.upper)} ms · ${
            value.unreliable === true || value.reliable === false ? 'unreliable' : 'reliable'
          }</small>`;

      const displayValue = value.available === false
        ? (value.reason === 'unavailable' ? 'Not applicable' : 'Insufficient correct responses')
        : estimate == null ? 'Needs a baseline'
        : genericMetricText(estimate, 'cost');

      const reliabilityText = module.id === 'flanker' && label === 'Interference cost' && metrics.reliability
        ? `<small>${metrics.reliability.status}</small>` : '';

      return `<div class="metric"><small>${label}</small><b>${displayValue}</b>${intervalText}${reliabilityText}</div>`;
    }
    return `<div class="metric"><small>${label}</small><b>${genericMetricText(value, label)}</b></div>`;
  }).join('');
}

function finishGenericBlock() {
  if (!blockState || blockState.done) return;

  clearTimers();
  blockState.done = true;
  blockState.showingResult = true;

  const state    = blockState;
  const module   = state.module;
  const level    = state.level;
  const store    = taskStore(state.taskId);
  const existing = store.get();

  const metrics  = module.score(level, state.spec, state.responses, state.seed, existing);
  const timing   = {
    mean: window.HCCTTaskEngineCommon.mean(state.drifts),
    max:  state.drifts.length ? Math.max(...state.drifts) : 0,
  };
  const validity = module.validate(metrics, level, timing);

  let saved = null;
  if (state.mode === 'assessment') {
    const record = {
      ...metrics,
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts:          new Date().toISOString(),
      taskId:      state.taskId,
      levelId:     level.id,
      mode:        'assessment',
      seed:        state.seed,
      valid:       validity.valid,
      flags:       validity.flags,
      metrics,
      timing,
      frameCounts: state.frameCounts,
      rt:          metrics.medianRt || metrics.medianRT || metrics.rt || null,
      device: {
        hz:    DEV_INFO.hz,
        dpr:   window.devicePixelRatio,
        w:     innerWidth,
        h:     innerHeight,
        touch: 'ontouchstart' in window,
        ua:    navigator.userAgent.slice(0, 140),
      },
    };
    existing.push(record);
    saved = store.set(existing);
  }

  renderGenericResult(metrics, {
    level,
    practice: state.mode === 'practice',
    valid:    validity.valid,
    flags:    validity.flags,
    saved,
    task:     state.taskId,
  });
  renderLab();
}

function renderGenericResult(metrics, info) {
  const module = getTask().module;
  const value  = genericMetricValue(module, metrics);
  const status = info.valid ? module.statusOf(value) : 'Not scored';
  const rec    = module.recommend(info.level, metrics, info.valid);

  if (blockState) blockState.nextLevel = rec.next;

  const details = genericResultCards(module, metrics, info.level);

  qs('#labCard').innerHTML = `
    <div class="eyebrow">
      ${info.practice ? 'Practice result · not recorded' : 'Block result · recorded'}
      · Level ${info.level.id}
    </div>
    <div class="result-score">
      <div>
        <small class="progress-label">${module.profile.metricName}</small>
        <div class="big">${genericMetricText(value, module.profile.metricKey)}</div>
      </div>
      <span class="st ${stCls(status, module.policyType)}">${status}</span>
    </div>
    <div class="metrics">${details}</div>
    ${info.flags.map(flag => `<div class="flag">${module.flagText(flag)}</div>`).join('')}
    <p>${info.practice
      ? 'Practice scores are not stored. When ready, run a recorded block.'
      : rec.text}</p>
    ${info.saved === false ? `<div class="flag">Browser storage was unavailable, so this block could not be saved.</div>` : ''}
    <div class="footer-actions">
      <button class="btn primary" data-act="again">${info.practice ? 'Back to level' : 'Run another block'}</button>
      ${rec.next && rec.next !== info.level.id ? `<button class="btn" data-act="next">Go to Level ${rec.next}</button>` : ''}
      <button class="btn" data-go-profile="1">View profile</button>
    </div>`;
}

function abortGenericBlock(reason) {
  if (!blockState || blockState.done) return;

  clearTimers();
  blockState.done = true;
  blockState.showingResult = true;

  qs('#labCard').innerHTML = `
    <div class="eyebrow">Block not recorded</div>
    <h2>Stopped</h2>
    <p>${reason || 'You stopped the block.'} Nothing was saved or counted as low ability.</p>
    <div class="footer-actions">
      <button class="btn primary" data-act="again">Back to level ${blockState.level.id}</button>
    </div>`;
  renderLab();
}

// ================================================================
//  Timer management
// ================================================================

function clearTimers() {
  if (nbackState) {
    clearTimeout(nbackState.timer);
    clearTimeout(nbackState.hideTimer);
  }
  if (blockState) {
    clearTimeout(blockState.timer);
    clearTimeout(blockState.hideTimer);
    clearTimeout(blockState.maskTimer);
    clearTimeout(blockState.cueTimer);
    clearTimeout(blockState.countdownTimer);
    if (blockState.countdownInterval) clearInterval(blockState.countdownInterval);
    if (blockState.frameRequest)      cancelAnimationFrame(blockState.frameRequest);
  }
}

// ================================================================
//  Input event listeners
// ================================================================

// N-back keyboard.
document.addEventListener('keydown', e => {
  if (!nbackState || nbackState.done || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === INPUT_KEYS.letter.toLowerCase() || (key === ' ' && !nbackState.level.dual)) {
    e.preventDefault();
    getTask().module.ui.handleInput('letter');
  } else if (key === INPUT_KEYS.position.toLowerCase() && nbackState.level.dual) {
    e.preventDefault();
    getTask().module.ui.handleInput('pos');
  }
});

document.addEventListener('keyup', e => {
  if (nbackState && !nbackState.done && e.key === ' ') e.preventDefault();
});

// Generic task keyboard (F / J).
document.addEventListener('keydown', e => {
  if (!blockState || blockState.done || blockState.module.id === 'series') return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, textarea, select')) return;
  const key = e.key.toLowerCase();
  if (key === 'f' || key === 'j') {
    e.preventDefault();
    submitGenericResponse(key.toUpperCase());
  }
});

// Series form submit.
document.addEventListener('submit', e => {
  if (e.target.id !== 'seriesAnswerForm') return;
  e.preventDefault();
  const input = qs('#seriesAnswer');
  submitGenericResponse({ answer: input.value, cannotDetermine: false });
});

// Prevent mousedown from focusing buttons (preserves keyboard focus for responses).
document.addEventListener('mousedown', e => {
  if (e.target.closest('[data-resp]')) e.preventDefault();
});

// Pointer input for N-back response buttons.
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('[data-resp]');
  if (btn) getTask().module.ui.handleInput(btn.dataset.resp);
});

// Tab-hidden guard: abort any in-progress block.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ((nbackState && !nbackState.done) || (blockState && !blockState.done))) {
    abortBlock('The tab was hidden, so timing could not be trusted.');
  }
});

// General click router.
document.addEventListener('click', e => {
  // Keyboard F/J response buttons (generic tasks).
  const taskResponseBtn = e.target.closest('[data-task-response]');
  if (taskResponseBtn) { submitGenericResponse(taskResponseBtn.dataset.taskResponse); return; }

  // "Can't be determined" button (series).
  const undeterminedBtn = e.target.closest('[data-task-undetermined]');
  if (undeterminedBtn) { submitGenericResponse({ answer: '', cannotDetermine: true }); return; }

  // "Open in Lab" from task registry.
  const openTaskBtn = e.target.closest('[data-open-task]');
  if (openTaskBtn) {
    if (selectTask(openTaskBtn.dataset.openTask)) showPage('lab');
    return;
  }

  // Level selector in the ladder.
  const levelRow = e.target.closest('[data-level]');
  if (levelRow && !((nbackState && !nbackState.done) || (blockState && !blockState.done))) {
    curLevel = Number(levelRow.dataset.level);
    if (nbackState) nbackState.showingResult = false;
    if (blockState) blockState.showingResult = false;
    renderLab();
    renderIdle();
    return;
  }

  // Action buttons (practice, assess, abort, again, next, export, clear).
  const actionBtn = e.target.closest('[data-act]');
  if (actionBtn) {
    const act = actionBtn.dataset.act;
    if (act === 'practice') startBlock('practice');
    if (act === 'assess')   startBlock('assessment');
    if (act === 'abort')    abortBlock('You stopped the block.');
    if (act === 'again') {
      if (nbackState) nbackState.showingResult = false;
      if (blockState) blockState.showingResult = false;
      renderLab();
      renderIdle();
    }
    if (act === 'next') {
      if (nbackState) { curLevel = nbackState.nextLevel || curLevel; nbackState.showingResult = false; }
      if (blockState) { curLevel = blockState.nextLevel  || curLevel; blockState.showingResult  = false; }
      renderLab();
      renderIdle();
    }
    if (act === 'export-json') download('HCCT-nback-data.json', profileEngine.toJSON(allTaskBlocks()), 'application/json');
    if (act === 'export-csv')  download('HCCT-nback-data.csv',  profileEngine.toCSV(allTaskBlocks()),  'text/csv');
    if (act === 'clear') {
      if (confirm('Delete all recorded task blocks from this browser?')) {
        taskRegistry.forEach(task => taskStore(task.id).set([]));
        renderProfile();
      }
    }
  }

  if (e.target.closest('[data-go-profile]')) showPage('profile');
});

// Keyboard activation for ladder items.
document.addEventListener('keydown', e => {
  const levelRow = e.target.closest && e.target.closest('[data-level]');
  if (levelRow && (e.key === 'Enter' || e.key === ' ') &&
      !((nbackState && !nbackState.done) || (blockState && !blockState.done))) {
    e.preventDefault();
    levelRow.click();
  }
});

// ================================================================
//  Profile page
// ================================================================

function profileLevelStats(task, level, blocks) {
  const module      = task.module;
  const levelBlocks = blocks.filter(block => block.levelId === level.id);
  const result      = module.statusPolicy(levelBlocks);

  // Normalise meanValue from various field names.
  if (result.meanValue == null) {
    for (const key of ['meanD', 'meanAccuracy', 'meanCorrect', 'meanScore']) {
      if (result[key] != null) { result.meanValue = result[key]; break; }
    }
  }

  const valid = levelBlocks
    .filter(b => b.valid && b.mode === 'assessment')
    .sort((a, b) => a.ts < b.ts ? -1 : 1);

  const values = valid
    .map(block => Number(profileEngine.metricValue(task, block)))
    .filter(Number.isFinite);

  if (result.meanValue == null && values.length) {
    result.meanValue = window.HCCTTaskEngineCommon.mean(values.slice(-3));
  }
  if (result.first  == null && values.length) result.first  = values[0];
  if (result.latest == null && values.length) result.latest = values[values.length - 1];

  return result;
}

function chartSVG(task, stats) {
  const axis   = task.module.profile.axis;
  const W = 720, H = 230, l = 34, r = 10, t = 14, bt = 30;
  const innerW = W - l - r;
  const innerH = H - t - bt;
  const barW   = innerW / task.module.levels.length;

  const yPos = value =>
    t + innerH - (Math.max(axis.min, Math.min(axis.max, value)) - axis.min) / (axis.max - axis.min) * innerH;

  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${task.module.profile.metricName} by level">`;

  // Grid lines and Y-axis labels.
  axis.ticks.forEach(v => {
    svg += `<line x1="${l}" x2="${W - r}" y1="${yPos(v)}" y2="${yPos(v)}" stroke="#293746"/>`;
    svg += `<text x="${l - 6}" y="${yPos(v) + 4}" text-anchor="end">${v}</text>`;
  });

  // Reference lines.
  axis.referenceLines.forEach((line, i) => {
    const color = task.module.policyType === 'calibration' ? '#9aabba' : i === 0 ? '#f2c078' : '#8bd3c7';
    svg += `<line x1="${l}" x2="${W - r}" y1="${yPos(line.value)}" y2="${yPos(line.value)}" stroke="${color}" stroke-dasharray="4 4"/>`;
    svg += `<text x="${W - r}" y="${yPos(line.value) - 4}" text-anchor="end" style="fill:${color}">${line.label}</text>`;
  });

  // Bars per level.
  stats.forEach((stat, i) => {
    const x   = l + i * barW + barW * 0.2;
    const bw  = barW * 0.6;
    const val = stat.meanValue;

    if (stat.n) {
      const color = task.module.policyType === 'calibration' ? '#9aabba'
        : stat.status === 'Mastered'    ? '#8bd3c7'
        : stat.status === 'Developing'  ? '#f2c078'
        : '#ff9d9d';
      const top = yPos(val);
      const opacity = stat.n >= 3 ? 1 : stat.n === 2 ? 0.75 : 0.5;
      svg += `<rect x="${x}" y="${top}" width="${bw}" height="${Math.max(1, t + innerH - top)}" rx="4" fill="${color}" opacity="${opacity}"/>`;
      svg += `<text x="${x + bw / 2}" y="${top - 4}" text-anchor="middle">${val.toFixed(1)}</text>`;
    } else {
      svg += `<circle cx="${x + bw / 2}" cy="${t + innerH - 3}" r="3" fill="#3b4b5a"/>`;
    }

    svg += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">L${task.module.levels[i].id}</text>`;
  });

  return svg + '</svg>';
}

function taskSupplement(task, blocks) {
  const module = task.module;

  // ---- Flanker supplement: condition RT and interference cost ----
  if (module.id === 'flanker') {
    const rows = module.levels.map(level => {
      const recent = blocks
        .filter(b => b.levelId === level.id && b.valid && b.mode === 'assessment')
        .sort((a, b) => a.ts < b.ts ? -1 : 1);
      const block = recent[recent.length - 1];
      if (!block) return `<tr><td>L${level.id}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;

      const metrics    = block.metrics || block;
      const conditions = metrics.conditions || {};
      const firstCond  = conditions.congruent || conditions.single || conditions.neutral || {};
      const incongruent = conditions.incongruent || {};
      const cost        = metrics.interferenceCost || {};
      const reliability = metrics.reliability || {};

      const costText   = cost.available && cost.estimate != null
        ? `${Math.round(cost.estimate)} ms`
        : cost.reason === 'unavailable' ? 'Not applicable' : 'Insufficient responses';
      const interval   = cost.available && cost.lower != null
        ? `${Math.round(cost.lower)} to ${Math.round(cost.upper)} ms` : '—';
      const congruentRtText   = Number.isFinite(firstCond.medianRt)   ? `${Math.round(firstCond.medianRt)} ms`   : '—';
      const incongruentRtText = Number.isFinite(incongruent.medianRt) ? `${Math.round(incongruent.medianRt)} ms` : '—';

      return `<tr><td>L${level.id}</td><td>${congruentRtText}</td><td>${incongruentRtText}</td><td>${costText}</td><td>${interval}</td><td>${reliability.status || '—'}</td></tr>`;
    }).join('');

    return `
      <div class="card" style="margin-top:14px">
        <div class="eyebrow">Secondary measures</div>
        <h3>Condition reaction times and interference</h3>
        <p>Latest valid assessment block per level. Median reaction times include correct responses only. The first-condition RT is single-letter at L1, neutral at L2, and congruent at L3+; interference is the incongruent-minus-congruent median RT difference with a seeded bootstrap interval. These measures are descriptive and never affect status.</p>
        <div class="scroll">
          <table class="table">
            <thead><tr><th>Level</th><th>First condition median RT</th><th>Incongruent median RT</th><th>Interference</th><th>95% interval</th><th>Reliability</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ---- Switching supplement: switch and mixing costs ----
  if (module.id === 'switching') {
    const rows = module.levels.map(level => {
      const recent = blocks
        .filter(b => b.levelId === level.id && b.valid && b.mode === 'assessment')
        .sort((a, b) => a.ts < b.ts ? -1 : 1);
      const block = recent[recent.length - 1];
      if (!block) return `<tr><td>L${level.id}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;

      const switchCost  = block.switchCost  !== undefined ? block.switchCost  : block.metrics && block.metrics.switchCost;
      const mixingCost  = block.mixingCost  !== undefined ? block.mixingCost  : block.metrics && block.metrics.mixingCost;

      const costText    = switchCost && typeof switchCost === 'object' && switchCost.estimate != null
        ? `${Math.round(switchCost.estimate)} ms` : '—';
      const interval    = switchCost && typeof switchCost === 'object' && switchCost.lower != null
        ? `${Math.round(switchCost.lower)} to ${Math.round(switchCost.upper)} ms` : '—';
      const reliability = switchCost && typeof switchCost === 'object'
        ? (switchCost.reliable === true ? 'Reliable' : switchCost.reliable === false ? 'Unreliable' : 'Not established')
        : '—';
      const mixingText  = Number.isFinite(mixingCost)
        ? `${Math.round(mixingCost)} ms`
        : mixingCost === 'needs a baseline' ? 'Needs baseline' : '—';

      return `<tr><td>L${level.id}</td><td>${costText}</td><td>${interval}</td><td>${reliability}</td><td>${mixingText}</td></tr>`;
    }).join('');

    return `
      <div class="card" style="margin-top:14px">
        <div class="eyebrow">Secondary measures</div>
        <h3>Switch and mixing costs</h3>
        <p>Latest valid assessment block per level. Switch cost is the median reaction-time difference between correct switch and repeat trials; its bootstrap interval can be noisy. Mixing cost compares repeat-trial reaction time with a pure-rule baseline and is shown only when that baseline exists.</p>
        <div class="scroll">
          <table class="table">
            <thead><tr><th>Level</th><th>Switch cost</th><th>95% interval</th><th>Reliability</th><th>Mixing cost</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ---- Series supplement: Level 10 diagnostics ----
  if (module.id === 'series') {
    const levelTenBlocks = blocks
      .filter(b => b.levelId === 10 && b.mode === 'assessment')
      .sort((a, b) => a.ts < b.ts ? 1 : -1)
      .slice(0, 8);

    const rows = levelTenBlocks.map(block => {
      const metrics = block.metrics || block;
      return `<tr>
        <td>${new Date(block.ts).toLocaleDateString()}</td>
        <td>${block.valid ? 'Valid' : 'Not scored'}</td>
        <td>${Number(metrics.falseDeclines) || 0}</td>
        <td>${Number(metrics.falseAnswers) || 0}</td>
        <td>${Number(metrics.cannotDetermineCount) || 0}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="5">No Level 10 blocks yet.</td></tr>`;

    return `
      <div class="card" style="margin-top:14px">
        <div class="eyebrow">Level 10 diagnostic measures</div>
        <h3>Underdetermined-item responses</h3>
        <p>False declines are "Can't be determined" responses on solvable items; false answers are typed answers to underdetermined items. These counts are descriptive, not a validated measure.</p>
        <div class="scroll">
          <table class="table">
            <thead><tr><th>When</th><th>Validity</th><th>False declines</th><th>False answers</th><th>Can't be determined</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  return '';
}

function renderTaskProfile(task, blocks) {
  const module   = task.module;
  const levels   = module.levels;
  const metricName = module.profile.metricName;
  const stats    = levels.map(level => profileLevelStats(task, level, blocks));

  const validBlocks    = blocks.filter(b => b.valid && b.mode === 'assessment');
  const unscoredCount  = blocks.length - validBlocks.length;
  const masteredLevels = stats.map((s, i) => s.status === 'Mastered' ? i + 1 : 0).filter(Boolean);
  const topMastered    = masteredLevels.length ? Math.max(...masteredLevels) : null;
  const suggested      = module.suggestedLevel(blocks);

  const emptyState = blocks.length ? '' : `
    <div class="card">
      <h3>No recorded blocks yet</h3>
      <p>Run a recorded block in the Lab to begin. Each level is <span class="st calibration">Unassessed</span> until there is valid evidence; unassessed does not mean low.</p>
      <div class="footer-actions">
        <button class="btn primary" data-go="lab" onclick="showPage('lab')">Open the Lab</button>
      </div>
    </div>`;

  const levelRows = levels.map((level, i) => {
    const stat  = stats[i];
    const label = module.id === 'nback'
      ? `${level.tier} · ${(level.ms / 1000).toFixed(1)}s`
      : module.levelSummary(level);
    return `
      <tr>
        <td>L${level.id}</td>
        <td>${module.nameOf(level)}<br><small style="color:var(--muted)">${label}</small></td>
        <td>${stat.n}</td>
        <td>${stat.n && stat.first  != null ? Number(stat.first).toFixed(2)     : '—'}</td>
        <td>${stat.n && stat.latest != null ? Number(stat.latest).toFixed(2)    : '—'}</td>
        <td>${stat.n && stat.meanValue != null ? Number(stat.meanValue).toFixed(2) : '—'}</td>
        <td><span class="st ${stCls(stat.status, module.policyType)}">${stat.status}</span></td>
        <td>${stat.n ? stat.evidence : '—'}</td>
      </tr>`;
  }).join('');

  const historyRows = blocks
    .slice()
    .sort((a, b) => a.ts < b.ts ? 1 : -1)
    .slice(0, 12)
    .map(block => {
      const date  = new Date(block.ts);
      const flags = (block.flags || []).map(module.flagText).join('; ');
      return `
        <tr>
          <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>L${block.levelId} · ${module.nameOf(levels[block.levelId - 1])}</td>
          <td>${block.valid ? Number(profileEngine.metricValue(task, block)).toFixed(2) : '—'}</td>
          <td>${block.rt ? Math.round(block.rt) + ' ms' : '—'}</td>
          <td>${block.valid ? 'Valid' : 'Not scored'}${flags ? ` <small style="color:var(--warm)">· ${flags}</small>` : ''}</td>
        </tr>`;
    }).join('');

  const topStat   = topMastered ? stats[topMastered - 1] : null;
  const supplement = module.profile.renderSupplement
    ? module.profile.renderSupplement(blocks)
    : taskSupplement(task, blocks);
  const uncertaintyNote = module.profile.uncertaintyNote
    || (module.id === 'series' ? 'With 8 items, one item changes the score by 12.5 percentage points; a single block is a rough hint.' : '');

  return `
    <section class="section">
      ${emptyState}
      <div class="eyebrow">${module.meta.groups.join(' · ')}</div>
      <h2>${task.name}</h2>
      <div class="cards4">
        <div class="card">
          <small class="progress-label">Highest level mastered</small>
          <div class="big" style="font-size:38px;margin-top:8px">${topMastered ? 'L' + topMastered : 'None yet'}</div>
          <p style="margin-top:8px">${topMastered
            ? `${module.nameOf(levels[topMastered - 1])} · evidence: ${topStat.evidence}`
            : 'Not the same as low ability: it may simply be untested.'}</p>
        </div>
        <div class="card">
          <small class="progress-label">Valid recorded blocks</small>
          <div class="big" style="font-size:38px;margin-top:8px">${validBlocks.length}</div>
          <p style="margin-top:8px">${unscoredCount
            ? `${unscoredCount} block${unscoredCount > 1 ? 's' : ''} not scored (flags)`
            : 'No discarded blocks'}</p>
        </div>
        <div class="card">
          <small class="progress-label">Suggested next level</small>
          <div class="big" style="font-size:38px;margin-top:8px">L${suggested}</div>
          <p style="margin-top:8px">${module.nameOf(levels[suggested - 1])}</p>
        </div>
      </div>
      <div class="card">
        <div class="eyebrow">${metricName} by level</div>
        <h3>Mean of the last three valid blocks per level</h3>
        <p>Bar opacity shows evidence: faint = 1 block, medium = 2, solid = 3 or more. Dots are unassessed levels.</p>
        ${uncertaintyNote ? `<p>${uncertaintyNote}</p>` : ''}
        ${chartSVG(task, stats)}
      </div>
      ${supplement}
      <div class="card" style="margin-top:14px">
        <div class="eyebrow">Levels</div>
        <h3>Baseline and trend</h3>
        <p>"First" versus "Latest" shows your own change at that level. Part of any rise is learning the task, not capability.</p>
        <div class="scroll">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>Level</th><th>Blocks</th>
                <th>First ${module.profile.unit}</th><th>Latest ${module.profile.unit}</th>
                <th>Mean (last 3)</th><th>Status</th><th>Evidence</th>
              </tr>
            </thead>
            <tbody>${levelRows}</tbody>
          </table>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="eyebrow">Recent blocks</div>
        <div class="scroll">
          <table class="table">
            <thead>
              <tr><th>When</th><th>Level</th><th>${module.profile.unit}</th><th>Mean RT (hits)</th><th>Validity and flags</th></tr>
            </thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="eyebrow">What this profile can and cannot say</div>
        <p>A single task supports a statement about performance on this task, not a global capability. Results are exploratory and unvalidated.</p>
        <div class="footer-actions">
          <button class="btn" data-act="export-json">Export JSON</button>
          <button class="btn" data-act="export-csv">Export CSV</button>
          <button class="btn" data-act="clear">Clear data</button>
        </div>
        <p class="empty">Data stays in this browser only. Each record stores the random seed, device information, and timing drift so a block can be reproduced and checked.</p>
      </div>
    </section>`;
}

function renderProfile() {
  const taskProfiles = taskRegistry
    .map(task => renderTaskProfile(task, taskStore(task.id).get()))
    .join('');
  qs('#profileBody').innerHTML = `${taskProfiles}<div class="notice">There is no combined score across tasks.</div>`;
}

// ================================================================
//  Bootstrap
// ================================================================

const nbackTask = taskRegistry.find(task => task.id === 'nback');
nbackTask.module.ui.start       = startBlock;
nbackTask.module.ui.handleInput = respond;
nbackTask.module.ui.finish      = finishBlock;

render();
restore();
