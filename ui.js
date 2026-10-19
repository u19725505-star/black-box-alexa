function renderStrip(){
  const s=$('strip');
  if(!ledger.length){s.innerHTML='<div class="empty">Chain is empty. Ask Alexa+ to do something.</div>';return}
  s.innerHTML=ledger.map((e,i)=>
    (i?'<span class="lk"></span>':'<span class="gen">GENESIS</span><span class="lk"></span>')+
    `<div class="blk ${e.status}${e.undone?' undone':''}${e.id===lastId?' new':''}" data-id="${e.id}"><b>#${e.id}</b><small>${e.hash.slice(0,6)}</small></div>`
  ).join('');
  s.scrollLeft=s.scrollWidth;
}
function renderStats(){
  const spent=S.orders.reduce((a,o)=>a+o.amount,0);
  const c=(f)=>ledger.filter(f).length;
  const items=[[ledger.length,'actions'],[c(e=>e.status==='held'),'held'],[c(e=>e.status==='blocked'||e.status==='declined'),'blocked'],[c(e=>e.undone),'undone'],['$'+spent,'spent']];
  $('stats').innerHTML=items.map(x=>`<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
  const fs=[['all','All'],['done','Done'],['held','Held'],['blocked','Blocked'],['undone','Undone']];
  $('filters').innerHTML=fs.map(f=>`<button data-f="${f[0]}" class="${filter===f[0]?'sel':''}">${f[1]}</button>`).join('');
}
function renderLedger(){
  const list=[...ledger].reverse().filter(e=>{
    if(filter==='done')return e.status==='done'&&!e.undone;
    if(filter==='held')return e.status==='held';
    if(filter==='blocked')return e.status==='blocked'||e.status==='declined';
    if(filter==='undone')return e.undone;
    return true;
  });
  $('ledger').innerHTML=list.length?list.map(e=>`<div class="ent ${e.status}${e.undone?' undone':''}">
    <div class="eh"><b>#${e.id}</b><span>${esc(e.tool)}</span><span class="tag">${esc(e.status)}</span>${e.undone?'<span class="tag">undone</span>':''}<span class="t">${new Date(e.ts).toLocaleTimeString()}</span></div>
    <div class="rq">${esc(e.request)}</div>
    <div class="ex ${open[e.id]?'show':''}">${esc(e.reason)}<br><span class="mono">args ${esc(JSON.stringify(e.args))}<br>hash ${e.hash.slice(0,16)}…<br>prev ${e.prev.slice(0,16)}…</span></div>
    <div class="ea"><button data-why="${e.id}">Why?</button><button data-tog="${e.id}">Details</button></div>
  </div>`).join(''):'<div class="empty" style="margin-top:10px">No entries to show.</div>';
}
function renderHome(){
  const hue=Math.max(0,Math.min(210,(80-S.thermo)*10));
  $('home').innerHTML=`
  <div class="tile">🌡️ Thermostat<div class="big" style="color:hsl(${hue},85%,62%)">${S.thermo}°F</div></div>
  <div class="tile">${S.night?'🌙':'☀️'} Time<div class="big" style="font-size:30px;margin-top:8px">${S.night?'11:00 PM':'3:00 PM'}</div></div>
  <div class="tile">🛒 Orders<ul>${S.orders.length?S.orders.map(o=>'<li>'+esc(o.item)+' ($'+o.amount+')</li>').join(''):'<li>none</li>'}</ul></div>
  <div class="tile">📅 Calendar<ul>${S.cal.length?S.cal.map(c=>'<li>'+esc(c.title)+'</li>').join(''):'<li>empty</li>'}</ul></div>`;
}
function renderRails(){
  $('lim').value=S.limit;$('limv').textContent='$'+S.limit;
  $('qh').checked=S.quiet;$('nt').value=S.night?'night':'day';
  $('timev').textContent=S.night?'11:00 PM · Night':'3:00 PM · Day';
}
function render(){renderStrip();renderStats();renderLedger();renderHome();renderRails()}

function moveInd(){
  const b=document.querySelector('#tabs button.on'),i=$('ind');
  if(!b)return;
  i.style.width=b.offsetWidth+'px';
  i.style.transform='translateX('+(b.offsetLeft-16)+'px)';
}
function setTab(name){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='p-'+name));
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  moveInd();
}

async function runVerify(){
  if(!ledger.length){toast('Nothing to verify yet');return}
  const bad=await verify();
  const chips=[...document.querySelectorAll('#strip .blk')];
  chips.forEach(c=>c.classList.remove('ok','bad','dim','new'));
  let broken=false;
  for(const c of chips){
    if(broken){c.classList.add('dim');continue}
    if(bad&&+c.dataset.id===bad){broken=true;c.classList.add('bad');try{c.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}catch(e){}await sleep(260);continue}
    c.classList.add('ok');await sleep(130);
  }
  if(bad){
    setPill('BROKEN at #'+bad,'bad');toast('Chain broken at entry #'+bad,'bad');
    say('ai',`Warning: the chain is broken at entry ${bad}. A past record was altered after it was written.`);
  }else{
    setPill('intact · '+ledger.length,'ok');toast('Chain verified: '+ledger.length+' entries intact','ok');
    say('ai',`Chain verified. All ${ledger.length} entries are intact.`);
  }
}
function tamper(){
  const e=ledger.find(x=>x.tool==='place_order')||ledger[0];
  if(!e){toast('Do something first, then tamper with it');return}
  e.request=e.request+' (edited later)';
  lastId=0;renderLedger();renderStrip();
  toast('Record #'+e.id+' was edited after the fact','bad');
}
function resetAll(silent){
  try{if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}
  q=Promise.resolve();
  Object.assign(S,{thermo:70,orders:[],cal:[],limit:25,quiet:true,night:false,pending:null});
  ledger=[];n=0;lastId=0;open={};filter='all';
  $('chat').innerHTML='';setPill('empty','');setOrb('idle');
  if(!silent)say('ai','Hi, I am Alexa+. What would you like me to do?');
  render();
}
/* END */
