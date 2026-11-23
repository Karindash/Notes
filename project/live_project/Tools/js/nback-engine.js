(function () {
const LETTERS=['C','H','K','L','Q','R','S','T'];
  const MATCH_P=.3, MASTER=2.0, DEV=1.0, SCORED=30, PRACTICE=14;
  const LEVELS=[
  {id:1,tier:'Easy',n:0,dual:false,ms:2500,lure:0},
  {id:2,tier:'Easy',n:1,dual:false,ms:2500,lure:0},
  {id:3,tier:'Moderate',n:2,dual:false,ms:2500,lure:0},
  {id:4,tier:'Moderate',n:2,dual:false,ms:2000,lure:.2},
  {id:5,tier:'Hard',n:3,dual:false,ms:2500,lure:.15},
  {id:6,tier:'Hard',n:3,dual:false,ms:2000,lure:.25},
  {id:7,tier:'Hard',n:4,dual:false,ms:2000,lure:.25},
  {id:8,tier:'Very hard',n:2,dual:true,ms:2500,lure:.15},
  {id:9,tier:'Very hard',n:3,dual:true,ms:2500,lure:.2},
  {id:10,tier:'Extreme',n:3,dual:true,ms:2000,lure:.25},
  {id:11,tier:'Extreme',n:5,dual:true,ms:1800,lure:.3},
  {id:12,tier:'Impossible',n:7,dual:true,ms:1000,lure:.4}
  ];
  const nameOf=l=>(l.dual?'Dual ':'')+l.n+'-back';
  const stimMs=l=>Math.min(700,Math.round(l.ms*.5));
  function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  function probit(p){
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
  const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  const pl=.02425,ph=1-pl;let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  if(p<=ph){q=p-.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  /* log-linear corrected signal detection: avoids infinite d' at 0% / 100% */
  function sdt(h,T,f,F){const hr=(h+.5)/(T+1),fr=(f+.5)/(F+1),z1=probit(hr),z2=probit(fr);return{d:z1-z2,c:-(z1+z2)/2}}
  function genStream(L,scored,rnd,poolSize){
  const n=L.n,N=n+scored,vals=new Array(N),kinds=new Array(N).fill('W');
  const pick=ex=>{let v;do{v=Math.floor(rnd()*poolSize)}while(ex.includes(v));return v};
  const K=Math.round(MATCH_P*scored);
  if(n===0){
    const target=Math.floor(rnd()*poolSize);
    const set=new Set(shuffle([...Array(N).keys()],rnd).slice(0,K));
    for(let i=0;i<N;i++){if(set.has(i)){vals[i]=target;kinds[i]='T'}else{vals[i]=pick([target]);kinds[i]='F'}}
    return{vals,kinds,target};
  }
  for(let i=0;i<n;i++)vals[i]=Math.floor(rnd()*poolSize);
  const slots=shuffle([...Array(scored).keys()].map(k=>k+n),rnd);
  const M=Math.round(L.lure*(scored-K));
  const tSet=new Set(slots.slice(0,K)),lSet=new Set(slots.slice(K,K+M));
  for(let i=n;i<N;i++){
    const base=vals[i-n];
    if(tSet.has(i)){vals[i]=base;kinds[i]='T';continue}
    if(lSet.has(i)){
    const c=[];
    if(i-n-1>=0&&vals[i-n-1]!==base)c.push(vals[i-n-1]);
    if(n>=2&&vals[i-n+1]!==base)c.push(vals[i-n+1]);
    if(c.length){vals[i]=c[Math.floor(rnd()*c.length)];kinds[i]='L';continue}
    }
    vals[i]=pick([base]);kinds[i]='F';
  }
  return{vals,kinds,target:null};
  }
  function genSequence(L,scored,seed){
  const r=rng(seed),N=L.n+scored;
  const letter=genStream(L,scored,r,LETTERS.length);
  const pos=L.dual?genStream(L,scored,r,8):null;
  const trials=[];for(let i=0;i<N;i++)trials.push({letter:LETTERS[letter.vals[i]],pos:pos?pos.vals[i]:null});
  return{n:L.n,N,letter,pos,trials};
  }
  function isTarget(seq,i,m){
  const s=seq[m];if(!s||i<seq.n)return null;
  return seq.n===0?s.vals[i]===s.target:s.vals[i]===s.vals[i-seq.n];
  }
  /* resp[i] = {letter:rtMs|null, pos:rtMs|null} */
  function score(L,seq,resp){
  const mods=L.dual?['letter','pos']:['letter'];
  const out={mods:{},lureTrials:0,lureFAs:0,totalResp:0};const ds=[],rts=[];
  for(const m of mods){
    let hit=0,miss=0,fa=0,cr=0,T=0,F=0;const r=[];
    for(let i=seq.n;i<seq.N;i++){
    const t=isTarget(seq,i,m),rt=(resp[i]&&resp[i][m]!=null)?resp[i][m]:null,lure=seq[m].kinds[i]==='L';
    if(rt!=null)out.totalResp++;
    if(t){T++;if(rt!=null){hit++;r.push(rt)}else miss++}
    else{F++;if(lure)out.lureTrials++;if(rt!=null){fa++;if(lure)out.lureFAs++}else cr++}
    }
    const s=sdt(hit,T,fa,F);
    out.mods[m]={targets:T,nonTargets:F,hits:hit,misses:miss,fas:fa,crs:cr,hr:hit/T,far:fa/F,d:s.d,c:s.c,rt:mean(r)};
    ds.push(s.d);rts.push(...r);
  }
  out.dprime=mean(ds);out.rt=mean(rts);return out;
  }
  function validate(sc,L,timing){
  const flags=[];let valid=true;
  if(sc.totalResp===0){valid=false;flags.push('no_responses')}
  if(timing&&timing.max>300){valid=false;flags.push('timing_invalid')}
  else if(timing&&(timing.mean>40||timing.max>120))flags.push('timing_warning');
  for(const m in sc.mods){const x=sc.mods[m];
    if(x.far>=.7&&x.hr>=.7)flags.push('press_all_'+m);
    if(L.dual&&x.hits+x.fas===0&&sc.totalResp>0)flags.push('ignored_'+m);
  }
  return{valid,flags};
  }
  function flagText(f){
  if(f==='no_responses')return'No responses were made, so this block cannot be scored. It is not counted as low ability.';
  if(f==='timing_invalid')return'The browser delayed stimulus timing by more than 300 ms (background tab or heavy load). Block discarded as evidence.';
  if(f==='timing_warning')return'Timing was somewhat unstable on this device. d′ is still usable; reaction times are less reliable.';
  if(f.indexOf('press_all_')===0)return'Almost everything was answered as a match on the '+(f.slice(10)==='pos'?'position':'letter')+' channel. d′ then reflects no discrimination.';
  if(f.indexOf('ignored_')===0)return'The '+(f.slice(8)==='pos'?'position':'letter')+' channel received no responses, which pulls the dual-task score down.';
  return f;
  }
  function levelStats(blocks,id){
  return statusPolicy(blocks.filter(b=>b.levelId===id));
  }
  function suggestedLevel(blocks){for(const l of LEVELS){if(levelStats(blocks,l.id).status!=='Mastered')return l.id}return 12}
  function statusOf(d){return d>=MASTER?'Mastered':d>=DEV?'Developing':'Not yet'}
  function recommend(L,sc,valid){
  if(!valid)return{text:'This block could not be counted as evidence (see flags). Nothing here is treated as low ability. Try again when you can focus on this tab.',next:L.id};
  const d=sc.dprime;
  if(d>=MASTER)return L.id<12?{text:'Strong discrimination. Next: Level '+(L.id+1)+'.',next:L.id+1}:{text:'Level 12 is designed to be beyond typical performance. Repeat to confirm: one block at this level is very noisy.',next:12};
  if(d>=DEV)return{text:'Above chance but not yet stable. Repeat this level; more blocks give better evidence.',next:L.id};
  if(L.id>1)return{text:'Close to chance. Step down to Level '+(L.id-1)+' to find where performance is reliable.',next:L.id-1};
  return{text:'Close to chance even at Level 1. Check the instructions, your input device and your attention before drawing any conclusion.',next:1};
  }

  const meta={
  id:'nback',
  name:'N-back ladder',
  groups:['Working memory'],
  construct:'Working memory: information manipulation and mental updating.',
  procedure:'Respond when the current letter matches the letter shown n items earlier. At dual levels, judge letter and position independently.',
  stimuli:'Letters; dual levels also use positions in a text grid.',
  primaryMetric:'Sensitivity (d′)',
  difficultyAxis:'N-back level',
  confounds:['Sustained attention','Response speed and device latency','Strategy, motivation, fatigue, and practice effects'],
  validityRules:['No responses: not scored.','Timing drift over 300 ms: not scored.','High false-alarm and hit rates or an ignored dual-task channel are flagged.']
  };
  const links=[
  {capability:'Working memory › Information manipulation',weight:'0.8',kind:'primary',note:'Items must be held and compared with the one n steps back.'},
  {capability:'Working memory › Mental updating',weight:'0.8',kind:'primary',note:'The window slides every trial: old items drop out, new ones enter.'},
  {capability:'Attention › Sustained attention',weight:'0.4',kind:'secondary',note:'A block needs 40–90 s of continuous monitoring.'},
  {capability:'Inhibition › Cognitive inhibition',weight:'0.3',kind:'secondary',note:'Lure trials (n±1 matches) require rejecting items that feel familiar. Only informative at levels that include lures.'},
  {capability:'Information processing › Cognitive speed',weight:'0.3',kind:'secondary',note:'Grows in importance at levels with 2 s or less per item.'},
  {capability:'Execution › Response speed',weight:'0.1',kind:'confound',note:'Keypress speed and device latency mainly affect reaction time, less so d′.'},
  {capability:'Strategy (rehearsal, chunking, position tricks)',weight:'n/a',kind:'confound',note:'Different strategies change what the score reflects.'},
  {capability:'Motivation, fatigue, practice effect',weight:'n/a',kind:'confound',note:'Handled by baseline comparison, repeated blocks and validity flags, not removed.'}
  ];
  const profile={
  metricKey:'dprime',
  metricName:'Sensitivity (d′)',
  unit:'d′',
  axis:{min:0,max:4,ticks:[0,1,2,3,4],referenceLines:[{value:1,label:'developing ≥ 1'},{value:2,label:'mastered ≥ 2'}]}
  };
  const ui={start:null,handleInput:null,finish:null};
  function ruleText(L){
  if(L.n===0)return"A target letter is shown at the start. Press <b>L</b> (or Space) every time that letter appears.";
  const step=L.n===1?"1 step back":L.n+" steps back";
  if(!L.dual)return`Letters appear one at a time. Press <b>L</b> (or Space) when the letter is the same as the one <b>${step}</b>.`;
  return`Each item is a letter in a grid position. Press <b>A</b> if the <b>position</b> matches the one ${step}. Press <b>L</b> if the <b>letter</b> matches the one ${step}. The two are judged independently: both, one or neither may match.`;
  }
  function generate(level,seed,mode){
  return genSequence(level,mode==='practice'?PRACTICE:SCORED,seed);
  }
  function statusPolicy(levelBlocks){
  const v=levelBlocks.filter(b=>b.valid&&b.mode==='assessment').sort((a,b)=>a.ts<b.ts?-1:1);
  if(!v.length)return{status:'Unassessed',n:0};
  const md=mean(v.slice(-3).map(b=>b.dprime));
  return{status:md>=MASTER?'Mastered':md>=DEV?'Developing':'Not yet',n:v.length,meanD:md,first:v[0].dprime,latest:v[v.length-1].dprime,evidence:v.length>=3?'Better':v.length===2?'Moderate':'Low'};
  }
window.HCCTNBackEngine = Object.freeze({
  id:'nback',
  name:'N-back ladder',
  policyType:'capability',
  ui,
  meta,
  links,
  profile,
  ruleText,
  generate,
  statusPolicy,
  levels:LEVELS,
  LETTERS,
  MATCH_P,
  MASTER,
  DEV,
  SCORED,
  PRACTICE,
  LEVELS,
  nameOf,
  stimMs,
  mean,
  genSequence,
  isTarget,
  score,
  validate,
  flagText,
  levelStats,
  suggestedLevel,
  statusOf,
  recommend
});
})();
