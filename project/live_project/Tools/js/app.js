const {
  LETTERS,
  MATCH_P,
  SCORED,
  nameOf,
  mean,
  isTarget,
} = window.HCCTNBackEngine;
const taskRegistry = window.HCCTTaskRegistry;
const profileEngine = window.HCCTProfileEngine;
let selectedTaskId = taskRegistry[0].id;

function getTask(taskId=selectedTaskId){
  return taskRegistry.find(task=>task.id===taskId);
}
function selectTask(taskId){
const task=getTask(taskId);
if(!task){console.error(`Task is not registered: ${taskId}`);return false}
if(S&&!S.done)abortBlock("You changed tasks.");
selectedTaskId=task.id;$("#taskSelector").value=task.id;curLevel=1;S=null;renderLab();
return true;
}

  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const core=[
  ["Perception","Receiving and discriminating information from sensory input.","Visual recognition, auditory recognition, spatial awareness"],
  ["Attention","Selecting, sustaining, and shifting processing resources.","Selective, sustained, divided attention"],
  ["Memory","Encoding, retaining, and retrieving information.","Working, episodic, semantic, procedural memory"],
  ["Information Processing","Transforming, integrating, and representing information.","Abstraction, information integration, cognitive speed"],
  ["Reasoning","Drawing and evaluating inferences from available information.","Deductive, inductive, analogical, causal reasoning"],
  ["Decision Making","Evaluating alternatives and selecting a course of action.","Risk assessment, prioritization, resource allocation"],
  ["Execution","Translating intentions into controlled actions.","Coordination, precision, response speed, sequencing"],
  ["Adaptation","Adjusting behavior or strategy as conditions change.","Error correction, flexibility, transfer learning"]
  ];
  const additional=["Learning","Prediction","Simulation","Inhibition","Metacognition","Association"];
  const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}};
  function taskStore(taskId){
  const key=`hcct-${taskId}-blocks`;
  return{
    get(){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch(e){return[]}},
    set(v){return ls.set(key,JSON.stringify(v))}
  };
  }
  function allTaskBlocks(){
  return profileEngine.collectTaskBlocks(taskRegistry,id=>taskStore(id).get());
  }
  const reviewed=new Set(JSON.parse(ls.get("hcct-reviewed","[]")));

  taskRegistry.forEach(task=>{
  const option=document.createElement("option");option.value=task.id;option.textContent=task.name;$("#taskSelector").appendChild(option);
  });
  $("#taskSelector").value=selectedTaskId;
  $("#taskSelector").addEventListener("change",e=>{
  selectTask(e.target.value);
  });

  /* ---------- Phase 1 (unchanged behaviour) ---------- */
  function render(){
  $("#coreCards").innerHTML=core.map((x,i)=>`<article class="card"><div class="num">0${i+1}</div><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join("");
  $("#operationList").innerHTML=core.map((x,i)=>`<label class="operation"><input type="checkbox" data-review="${i}" ${reviewed.has(i)?"checked":""}><span><strong>${x[0]}</strong><small>${x[1]} Examples: ${x[2]}.</small></span><span class="tag">${reviewed.has(i)?"Reviewed":"Candidate"}</span></label>`).join("");
  $("#additionalList").innerHTML=additional.map(x=>`<div class="question"><b>${x}</b><p>Classify as primitive, cross-cutting function, composite process, or unresolved.</p></div>`).join("");
  updateProgress();
  }
  function updateProgress(){const n=reviewed.size;$("#progressText").textContent=`${n} of 8 reviewed`;$("#progressBar").style.width=(n/8*100)+"%"}
  document.addEventListener("change",e=>{
  if(e.target.matches("[data-review]")){const n=Number(e.target.dataset.review);e.target.checked?reviewed.add(n):reviewed.delete(n);ls.set("hcct-reviewed",JSON.stringify([...reviewed]));render()}
  if(e.target.matches("[data-deliverable]")){const vals=JSON.parse(ls.get("hcct-deliverables","{}"));vals[e.target.dataset.deliverable]=e.target.checked;ls.set("hcct-deliverables",JSON.stringify(vals))}
  if(e.target.id==="foundationChoice")ls.set("hcct-foundation",e.target.value);
  });
  function restore(){
  $("#primitiveRule").value=ls.get("hcct-rule","");
  $("#reviewNotes").value=ls.get("hcct-notes","");
  $("#foundationChoice").value=ls.get("hcct-foundation","");
  const vals=JSON.parse(ls.get("hcct-deliverables","{}"));
  $$("[data-deliverable]").forEach(e=>e.checked=!!vals[e.dataset.deliverable]);
  }
  $("#saveReview").addEventListener("click",()=>{ls.set("hcct-rule",$("#primitiveRule").value);ls.set("hcct-notes",$("#reviewNotes").value);$("#saveStatus").textContent="Saved locally in this browser."});
  function exportText(){
  const lines=["# HCCT — Phase 1 Review","",`Reviewed core groups: ${reviewed.size}/8`,"","## Primitive inclusion criterion",$("#primitiveRule").value||"_Not defined_","","## Foundational position",$("#foundationChoice").value||"_Undecided_","","## Review notes",$("#reviewNotes").value||"_No notes yet_","","## Core group status",...core.map((x,i)=>`- [${reviewed.has(i)?"x":" "}] ${x[0]} — ${x[1]}`),"","## Phase 1 deliverables",...$$("[data-deliverable]").map(e=>`- [${e.checked?"x":" "}] ${e.parentElement.querySelector("strong").textContent}`)];
  return lines.join("\n");
  }
  function download(name,data,type){const blob=new Blob([data],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}
  $("#exportReview").addEventListener("click",()=>download("HCCT-Phase-1-Review.md",exportText(),"text/markdown"));
  $("#downloadNotes").addEventListener("click",()=>download("HCCT-About-and-Phase-1.md",`# Human Cognitive Capability Taxonomy (HCCT)\n\n## About\nAn exploratory framework for mapping the capabilities humans use to perceive, process, remember, reason, decide, act, learn, and adapt.\n\n## Working definition\nHuman cognitive capability is the set of mental and behavioral capabilities through which a person receives and interprets stimuli, transforms information, evaluates situations, makes decisions, executes actions, learns, and adapts.\n\n## Phase 1 — Primitive review\nReview these candidate groups:\n${core.map(x=>"- **"+x[0]+"** — "+x[1]+" Examples: "+x[2]+".").join("\n")}\n\nAdditional functions to classify: ${additional.join(", ")}.\n\n## Lab\nv0.2 adds a 12-level n-back ladder (working memory) scored with d-prime.\n\n## Methodological note\nHCCT is conceptual and exploratory. It is not a validated psychological test.\n`,"text/markdown"));

  /* ---------- Navigation ---------- */
  function showPage(name){
  if(S&&!S.done&&name!=="lab")abortBlock("You left the Lab page.");
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===name));
  $$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  if(name==="registry")renderTaskRegistry();
  if(name==="lab")renderLab();
  if(name==="profile")renderProfile();
  window.scrollTo({top:0,behavior:"smooth"});
  }
  $$("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  $$("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));

  /* ---------- Task registry ---------- */
  function renderTaskRegistry(){
  $("#registryCount").textContent=`${taskRegistry.length} registered ${taskRegistry.length===1?"task":"tasks"}`;
  $("#taskRegistryList").innerHTML=taskRegistry.map(task=>{
    const meta=task.module.meta;
    return`<article class="card registry-card">
      <div class="registry-card-head"><span class="tag">${task.id}</span><span class="st calibration">Registered</span></div>
      <div class="eyebrow">${meta.groups.join(" · ")}</div>
      <h2>${task.name}</h2>
      <p>${meta.construct}</p>
      <div class="registry-facts">
        <div><small>Difficulty levels</small><strong>${task.module.levels.length}</strong></div>
        <div><small>Primary metric</small><strong>${meta.primaryMetric}</strong></div>
        <div><small>Difficulty axis</small><strong>${meta.difficultyAxis}</strong></div>
        <div><small>Stimuli</small><strong>${meta.stimuli}</strong></div>
      </div>
      <div class="footer-actions"><button class="btn primary" type="button" data-open-task="${task.id}">Open in Lab</button></div>
    </article>`;
  }).join("");
  }

  /* ---------- N-back lab ---------- */
  let curLevel=1,S=null;const DEV_INFO={hz:null};
  const CELLS=[0,1,2,3,5,6,7,8];
  function measureHz(){return new Promise(res=>{let n=0,t0=null;function f(t){if(t0===null)t0=t;n++;if(n>=40)res(Math.round(1000/((t-t0)/(n-1))));else requestAnimationFrame(f)}requestAnimationFrame(f);setTimeout(()=>res(null),2500)})}
  measureHz().then(h=>{DEV_INFO.hz=h});
  const stCls=(s,policy=getTask().module.policyType)=>policy==="calibration"?"calibration":({Mastered:"mastered",Developing:"developing","Not yet":"notyet"}[s]||"");

  function renderTaskCard(task){
  const m=task.module.meta;
  $("#taskCard").innerHTML=`<article class="card"><div class="eyebrow">${m.groups.join(" · ")}</div><h2>${m.name}</h2><p><strong>Construct:</strong> ${m.construct}</p><p><strong>Procedure:</strong> ${m.procedure}</p><p><strong>Stimuli:</strong> ${m.stimuli}</p><p><strong>Primary metric:</strong> ${m.primaryMetric} · <strong>Difficulty:</strong> ${m.difficultyAxis}</p><div class="notice"><b>Confounds</b><ul>${m.confounds.map(x=>`<li>${x}</li>`).join("")}</ul><b>Validity rules</b><ul>${m.validityRules.map(x=>`<li>${x}</li>`).join("")}</ul></div></article>`;
  }
  function renderLab(){
  const task=getTask(),module=task.module,levels=module.levels,blocks=taskStore(task.id).get();
  const sug=module.suggestedLevel(blocks);
  const stats=levels.map(l=>module.statusPolicy(blocks.filter(b=>b.levelId===l.id)));
  const nM=stats.filter(s=>s.status==="Mastered").length;
  $("#labProgText").textContent=`${nM} of ${levels.length} mastered`;$("#labProgBar").style.width=(nM/levels.length*100)+"%";
  renderTaskCard(task);
  const running=S&&!S.done;
  $("#ladder").classList.toggle("locked",!!running);
  $("#ladder").innerHTML=levels.map((l,i)=>`<div class="lv ${l.id===curLevel?"sel":""}" data-level="${l.id}" data-tier="${l.tier}" role="button" tabindex="0"><b>L${l.id}</b><span class="lvmain"><strong>${module.nameOf(l)}${l.id===sug?" ▶":""}</strong><small>${l.tier} · ${(l.ms/1000).toFixed(1)}s per item${l.lure?` · lures ${Math.round(l.lure*100)}%`:""}</small></span><span class="st ${stCls(stats[i].status,module.policyType)}">${stats[i].status}</span></div>`).join("");
  $("#linkList").innerHTML=module.links.map(x=>`<div class="link ${x.kind==="confound"?"conf":""}"><span class="w">${x.weight}<br><small>${x.kind}</small></span><div><strong>${x.capability}</strong><span>${x.note}</span></div></div>`).join("");
  if(!running&&!(S&&S.showingResult))renderIdle();
  }
  function renderIdle(){
  const module=getTask().module,L=module.levels[curLevel-1];
  $("#labCard").innerHTML=`<div class="eyebrow">Level ${L.id} · ${L.tier}</div><h2>${module.nameOf(L)}</h2><p>${module.ruleText(L)}</p>
  <div class="metrics">
    <div class="metric"><small>Memory load</small><b>${L.n===0?"Target only":L.n+" back"}</b></div>
    <div class="metric"><small>Pace</small><b>${(L.ms/1000).toFixed(1)} s / item</b></div>
    <div class="metric"><small>Channels</small><b>${L.dual?"Letter + position":"Letter"}</b></div>
    <div class="metric"><small>Lure rate</small><b>${L.lure?Math.round(L.lure*100)+"%":"None"}</b></div>
    <div class="metric"><small>Scored trials</small><b>${SCORED}${L.n?` (+${L.n} warm-up)`:""}</b></div>
    <div class="metric"><small>Targets</small><b>~${Math.round(MATCH_P*100)}% per channel</b></div>
  </div>
  ${L.tier==="Impossible"?`<div class="flag">Level 12 is designed to sit beyond typical unaided human performance, so it can reveal your ceiling. It is not a pass mark, and "impossible" here means very unlikely, not proven impossible.</div>`:""}
  <div class="footer-actions"><button class="btn" data-act="practice">Practice · with feedback</button><button class="btn primary" data-act="assess">Start recorded block</button></div>
  <p class="empty">Use a keyboard if you can. Stay on this tab, as switching away cancels the block. Practice is never recorded.</p>`;
  }
  function renderRunning(){
  const L=S.L;
  const cells=[...Array(9).keys()].map(i=>`<div class="cell ${i===4?"center":""}" data-cell="${i}"></div>`).join("");
  $("#labCard").innerHTML=`<div class="runhead"><span class="tag">${S.mode==="practice"?"PRACTICE · feedback on · not recorded":"RECORDED · no feedback"}</span><span id="trialText" class="progress-label">Get ready</span></div>
  <div class="stage">
    <div class="targetbox">${L.n===0?`Target letter <b>${LETTERS[S.seq.letter.target]}</b>`:`Compare with <b>${L.n}</b> back`}</div>
    <div class="nb-grid ${L.dual?"":"single"}">${cells}</div>
    <div class="resp">${L.dual?`<button class="rbtn" data-resp="pos">Position match<small>A</small></button>`:""}<button class="rbtn" data-resp="letter">Letter match<small>L${L.dual?"":" / Space"}</small></button></div>
    <div id="runMsg" class="empty"></div>
    <button class="btn" data-act="abort">Stop block</button>
  </div>`;
  }
  const setMsg=t=>{const e=$("#runMsg");if(e)e.textContent=t};

  function startBlock(mode){
  if(S&&!S.done)return;
  const module=getTask().module,L=module.levels[curLevel-1],seed=(Math.random()*4294967296)>>>0;
  const seq=module.generate(L,seed,mode);
  S={L,mode,seq,k:-1,onset:[],resp:Array.from({length:seq.N},()=>({letter:null,pos:null})),drifts:[],seed,t0:0,timer:null,hide:null,done:false};
  renderRunning();renderLab();
  countdown(3);
  }
  function countdown(c){
  if(!S||S.done)return;
  if(c===0){S.t0=performance.now()+60;S.timer=setTimeout(()=>runTrial(0),60);return}
  setMsg(`Starting in ${c}…`);S.timer=setTimeout(()=>countdown(c-1),1000);
  }
  function feedbackText(k){
  const out=[];
  for(const m of(S.L.dual?["letter","pos"]:["letter"])){
    const t=getTask().module.isTarget(S.seq,k,m);
    if(t&&S.resp[k][m]==null)out.push("Missed a "+(m==="pos"?"position":"letter")+" match");
  }
  return out.join(" · ");
  }
  function runTrial(k){
  if(!S||S.done)return;
  const fb=(S.mode==="practice"&&k>0)?feedbackText(k-1):"";
  if(k>=S.seq.N)return getTask().module.ui.finish();
  const now=performance.now();S.k=k;S.onset[k]=now;S.drifts.push(Math.abs(now-(S.t0+k*S.L.ms)));
  $$(".rbtn").forEach(b=>b.classList.remove("pressed","ok","bad"));
  showStim(k);setMsg(fb);
  const tt=$("#trialText");if(tt)tt.textContent=`Trial ${k+1} / ${S.seq.N}`;
  S.hide=setTimeout(hideStim,getTask().module.stimMs(S.L));
  S.timer=setTimeout(()=>runTrial(k+1),Math.max(0,S.t0+(k+1)*S.L.ms-performance.now()));
  }
  function showStim(k){
  hideStim();const tr=S.seq.trials[k],idx=S.L.dual?CELLS[tr.pos]:4,c=$(`[data-cell="${idx}"]`);
  if(c){c.textContent=tr.letter;c.classList.add("on")}
  }
  function hideStim(){$$(".cell").forEach(c=>{c.textContent="";c.classList.remove("on")})}
  function respond(mod){
  if(!S||S.done||S.k<0||S.k>=S.seq.N)return;
  if(mod==="pos"&&!S.L.dual)return;
  const r=S.resp[S.k];if(r[mod]!=null)return;
  r[mod]=performance.now()-S.onset[S.k];
  const b=$(`[data-resp="${mod}"]`);
  if(b){b.classList.add("pressed");
    if(S.mode==="practice"){const t=isTarget(S.seq,S.k,mod);if(t!==null){b.classList.remove("pressed");b.classList.add(t?"ok":"bad")}}}
  }
  document.addEventListener("keydown",e=>{
  if(!S||S.done||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==="l"||(k===" "&&!S.L.dual)){e.preventDefault();getTask().module.ui.handleInput("letter")}
  else if(k==="a"&&S.L.dual){e.preventDefault();getTask().module.ui.handleInput("pos")}
  });
  document.addEventListener("keyup",e=>{if(S&&!S.done&&e.key===" ")e.preventDefault()});
  document.addEventListener("mousedown",e=>{if(e.target.closest("[data-resp]"))e.preventDefault()});
  document.addEventListener("pointerdown",e=>{const b=e.target.closest("[data-resp]");if(b)getTask().module.ui.handleInput(b.dataset.resp)});
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&S&&!S.done)abortBlock("The tab was hidden, so timing could not be trusted.")});

  function clearTimers(){if(S){clearTimeout(S.timer);clearTimeout(S.hide)}}
  function abortBlock(reason){
  if(!S||S.done)return;
  clearTimers();S.done=true;S.showingResult=true;
  const el=$("#labCard");
  if(el)el.innerHTML=`<div class="eyebrow">Block not recorded</div><h2>Stopped</h2><p>${reason||"You stopped the block."} Nothing was saved and nothing was counted as low ability.</p><div class="footer-actions"><button class="btn primary" data-act="again">Back to level ${curLevel}</button></div>`;
  renderLab();
  }
  function finishBlock(){
  clearTimers();S.done=true;S.showingResult=true;
  const module=getTask().module,L=S.L,sc=module.score(L,S.seq,S.resp);
  if(S.mode==="practice"){renderResult(sc,{L,practice:true,valid:true,flags:[]});renderLab();return}
  const timing={mean:mean(S.drifts),max:Math.max(...S.drifts)};
  const v=module.validate(sc,L,timing);
  const rec={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:new Date().toISOString(),levelId:L.id,n:L.n,dual:L.dual,ms:L.ms,mode:"assessment",seed:S.seed,scored:SCORED,
    valid:v.valid,flags:v.flags,dprime:sc.dprime,rt:sc.rt,mods:sc.mods,lureTrials:sc.lureTrials,lureFAs:sc.lureFAs,timing,
    device:{hz:DEV_INFO.hz,dpr:window.devicePixelRatio,w:innerWidth,h:innerHeight,touch:"ontouchstart" in window,ua:navigator.userAgent.slice(0,140)}};
  const blockStore=taskStore(getTask().id),all=blockStore.get();all.push(rec);const ok=blockStore.set(all);
  renderResult(sc,{L,practice:false,valid:v.valid,flags:v.flags,saved:ok});renderLab();
  }
  function renderResult(sc,info){
  const module=getTask().module,L=info.L,rec=module.recommend(L,sc,info.valid);
  const status=info.valid?module.statusOf(sc.dprime):"Not scored";
  S.nextLevel=info.practice?L.id:rec.next;
  const mods=Object.keys(sc.mods).map(m=>{const x=sc.mods[m];return`<div class="metric"><small>${m==="pos"?"Position":"Letter"} · hits / false alarms</small><b>${x.hits}/${x.targets} · ${x.fas}/${x.nonTargets}</b><small>d′ ${x.d.toFixed(2)}${x.rt?` · ${Math.round(x.rt)} ms`:""}</small></div>`}).join("");
  $("#labCard").innerHTML=`<div class="eyebrow">${info.practice?"Practice result · not recorded":"Block result · recorded"} · Level ${L.id} ${nameOf(L)}</div>
  <div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;margin:10px 0"><div><small class="progress-label">d′ (sensitivity)</small><div class="big">${info.valid?sc.dprime.toFixed(2):"—"}</div></div><span class="st ${stCls(status)}">${status}</span></div>
  <div class="metrics">${mods}<div class="metric"><small>Lure false alarms</small><b>${L.lure?sc.lureFAs+" / "+sc.lureTrials:"n/a"}</b></div></div>
  ${info.flags.map(f=>`<div class="flag">${module.flagText(f)}</div>`).join("")}
  <p>${info.practice?"Practice scores are not stored. When you are ready, start a recorded block.":rec.text}</p>
  ${info.saved===false?`<div class="flag">Browser storage was unavailable, so this block could not be saved.</div>`:""}
  <p class="empty">d′ of about 0 means chance, 1 means some real discrimination, 2 or more means strong discrimination. A block has only about ${Math.round(MATCH_P*SCORED)} targets per channel, so expect roughly ±0.5 of noise.</p>
  <div class="footer-actions"><button class="btn primary" data-act="again">${info.practice?"Back to level":"Run another block"}</button>${(!info.practice&&rec.next!==L.id)?`<button class="btn" data-act="next">Go to Level ${rec.next}</button>`:""}<button class="btn" data-go-profile="1">View profile</button></div>`;
  }

  document.addEventListener("click",e=>{
  const registryButton=e.target.closest("[data-open-task]");
  if(registryButton){
    if(selectTask(registryButton.dataset.openTask))showPage("lab");
    return;
  }
  const lv=e.target.closest("[data-level]");
  if(lv&&!(S&&!S.done)){curLevel=Number(lv.dataset.level);if(S)S.showingResult=false;renderLab();renderIdle();return}
  const a=e.target.closest("[data-act]");
  if(a){
    const act=a.dataset.act;
    if(act==="practice")getTask().module.ui.start("practice");
    if(act==="assess")getTask().module.ui.start("assessment");
    if(act==="abort")abortBlock("You stopped the block.");
    if(act==="again"){if(S)S.showingResult=false;renderLab();renderIdle()}
    if(act==="next"){if(S){curLevel=S.nextLevel||curLevel;S.showingResult=false}renderLab();renderIdle()}
    if(act==="export-json")download("HCCT-nback-data.json",profileEngine.toJSON(allTaskBlocks()),"application/json");
    if(act==="export-csv")download("HCCT-nback-data.csv",profileEngine.toCSV(allTaskBlocks()),"text/csv");
    if(act==="clear"){if(confirm("Delete all recorded task blocks from this browser?")){taskRegistry.forEach(task=>taskStore(task.id).set([]));renderProfile()}}
  }
  if(e.target.closest("[data-go-profile]"))showPage("profile");
  });
  document.addEventListener("keydown",e=>{const lv=e.target.closest&&e.target.closest("[data-level]");if(lv&&(e.key==="Enter"||e.key===" ")&&!(S&&!S.done)){e.preventDefault();lv.click()}});

  /* ---------- Profile ---------- */
  function chartSVG(task,stats){
  const axis=task.module.profile.axis,W=720,H=230,l=34,r=10,t=14,bt=30,iw=W-l-r,ih=H-t-bt,bw=iw/task.module.levels.length;
  const y=v=>t+ih-(Math.max(axis.min,Math.min(axis.max,v))-axis.min)/(axis.max-axis.min)*ih;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${task.module.profile.metricName} by level">`;
  axis.ticks.forEach(v=>{s+=`<line x1="${l}" x2="${W-r}" y1="${y(v)}" y2="${y(v)}" stroke="#293746"/><text x="${l-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`});
  axis.referenceLines.forEach((line,i)=>{const tone=task.module.policyType==="calibration"?"#9aabba":i===0?"#f2c078":"#8bd3c7";s+=`<line x1="${l}" x2="${W-r}" y1="${y(line.value)}" y2="${y(line.value)}" stroke="${tone}" stroke-dasharray="4 4"/><text x="${W-r}" y="${y(line.value)-4}" text-anchor="end" style="fill:${tone}">${line.label}</text>`});
  stats.forEach((st,i)=>{
    const x=l+i*bw+bw*.2,w=bw*.6,value=st.meanD;
    if(st.n){const col=task.module.policyType==="calibration"?"#9aabba":st.status==="Mastered"?"#8bd3c7":st.status==="Developing"?"#f2c078":"#ff9d9d",top=y(value);
    s+=`<rect x="${x}" y="${top}" width="${w}" height="${Math.max(1,t+ih-top)}" rx="4" fill="${col}" opacity="${st.n>=3?1:st.n===2?.75:.5}"/>`;
    s+=`<text x="${x+w/2}" y="${top-4}" text-anchor="middle">${value.toFixed(1)}</text>`}
    else s+=`<circle cx="${x+w/2}" cy="${t+ih-3}" r="3" fill="#3b4b5a"/>`;
    s+=`<text x="${x+w/2}" y="${H-10}" text-anchor="middle">L${task.module.levels[i].id}</text>`;
  });
  return s+`</svg>`;
  }
  function renderTaskProfile(task,blocks){
  const module=task.module,levels=module.levels,metric=module.profile.metricName;
  const stats=levels.map(level=>module.statusPolicy(blocks.filter(b=>b.levelId===level.id)));
  const valid=blocks.filter(b=>b.valid&&b.mode==="assessment"),unscored=blocks.length-valid.length;
  const mastered=stats.map((s,i)=>s.status==="Mastered"?i+1:0).filter(Boolean),top=mastered.length?Math.max(...mastered):null;
  const suggested=module.suggestedLevel(blocks);
  const emptyState=blocks.length?"":`<div class="card"><h3>No recorded blocks yet</h3><p>Run a recorded block in the Lab to begin. Each level is <span class="st calibration">Unassessed</span> until there is valid evidence; unassessed does not mean low.</p><div class="footer-actions"><button class="btn primary" data-go="lab" onclick="showPage('lab')">Open the Lab</button></div></div>`;
  const rows=levels.map((level,i)=>{const stat=stats[i];return`<tr><td>L${level.id}</td><td>${module.nameOf(level)}<br><small style="color:var(--muted)">${level.tier} · ${(level.ms/1000).toFixed(1)}s</small></td><td>${stat.n}</td><td>${stat.n?stat.first.toFixed(2):"—"}</td><td>${stat.n?stat.latest.toFixed(2):"—"}</td><td>${stat.n?stat.meanD.toFixed(2):"—"}</td><td><span class="st ${stCls(stat.status,module.policyType)}">${stat.status}</span></td><td>${stat.n?stat.evidence:"—"}</td></tr>`}).join("");
  const hist=blocks.slice().sort((a,b)=>a.ts<b.ts?1:-1).slice(0,12).map(block=>{const date=new Date(block.ts),flags=(block.flags||[]).map(module.flagText).join("; ");return`<tr><td>${date.toLocaleDateString()} ${date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</td><td>L${block.levelId} · ${module.nameOf(levels[block.levelId-1])}</td><td>${block.valid?Number(profileEngine.metricValue(task,block)).toFixed(2):"—"}</td><td>${block.rt?Math.round(block.rt)+" ms":"—"}</td><td>${block.valid?"Valid":"Not scored"}${flags?` <small style="color:var(--warm)">· ${flags}</small>`:""}</td></tr>`}).join("");
  const best=top?stats[top-1]:null;
  return`<section class="section">${emptyState}
  <div class="eyebrow">${module.meta.groups.join(" · ")}</div><h2>${task.name}</h2>
  <div class="cards4">
    <div class="card"><small class="progress-label">Highest level mastered</small><div class="big" style="font-size:38px;margin-top:8px">${top?"L"+top:"None yet"}</div><p style="margin-top:8px">${top?module.nameOf(levels[top-1])+" · evidence: "+best.evidence:"Not the same as low ability: it may simply be untested."}</p></div>
    <div class="card"><small class="progress-label">Valid recorded blocks</small><div class="big" style="font-size:38px;margin-top:8px">${valid.length}</div><p style="margin-top:8px">${unscored?unscored+" block"+(unscored>1?"s":"")+" not scored (flags)":"No discarded blocks"}</p></div>
    <div class="card"><small class="progress-label">Suggested next level</small><div class="big" style="font-size:38px;margin-top:8px">L${suggested}</div><p style="margin-top:8px">${module.nameOf(levels[suggested-1])}</p></div>
  </div>
  <div class="card"><div class="eyebrow">${metric} by level</div><h3>Mean of the last three valid blocks per level</h3><p>Bar opacity shows evidence: faint = 1 block, medium = 2, solid = 3 or more. Dots are unassessed levels.</p>${chartSVG(task,stats)}</div>
  <div class="card" style="margin-top:14px"><div class="eyebrow">Levels</div><h3>Baseline and trend</h3><p>"First" versus "Latest" shows your own change at that level. Part of any rise is learning the task, not capability.</p><div class="scroll"><table class="table"><thead><tr><th>#</th><th>Level</th><th>Blocks</th><th>First ${module.profile.unit}</th><th>Latest ${module.profile.unit}</th><th>Mean (last 3)</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="card" style="margin-top:14px"><div class="eyebrow">Recent blocks</div><div class="scroll"><table class="table"><thead><tr><th>When</th><th>Level</th><th>${module.profile.unit}</th><th>Mean RT (hits)</th><th>Validity and flags</th></tr></thead><tbody>${hist}</tbody></table></div></div>
  <div class="card" style="margin-top:14px"><div class="eyebrow">What this profile can and cannot say</div><p>A single task supports a statement about performance on this task, not a global capability. Results are exploratory and unvalidated.</p>
    <div class="footer-actions"><button class="btn" data-act="export-json">Export JSON</button><button class="btn" data-act="export-csv">Export CSV</button><button class="btn" data-act="clear">Clear data</button></div>
    <p class="empty">Data stays in this browser only. Each record stores the random seed, device information, and timing drift so a block can be reproduced and checked.</p></div>
  </section>`;
  }
  function renderProfile(){
  const taskProfiles=taskRegistry.map(task=>renderTaskProfile(task,taskStore(task.id).get())).join("");
  $("#profileBody").innerHTML=`${taskProfiles}<div class="notice">There is no combined score across tasks.</div>`;
  }

  getTask().module.ui.start=startBlock;
  getTask().module.ui.handleInput=respond;
  getTask().module.ui.finish=finishBlock;
  render();restore();
