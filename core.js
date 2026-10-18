const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S={thermo:70,orders:[],cal:[],limit:25,quiet:true,night:false,pending:null,voice:true};
let ledger=[],n=0,lastId=0,filter='all',running=false,open={},q=Promise.resolve();

async function sha(s){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const fp=(e,prev)=>JSON.stringify([e.id,e.ts,e.tool,e.args,e.request,e.reason,e.status,prev]);
async function record(e){
  const prev=ledger.length?ledger[ledger.length-1].hash:'GENESIS';
  const body={id:++n,ts:new Date().toISOString(),tool:e.tool,args:e.args||{},request:e.request,reason:e.reason,status:e.status||'done'};
  body.prev=prev;
  body.hash=await sha(fp(body,prev));
  ledger.push({...body,undo:e.undo||null,undone:false});
  lastId=body.id;
  render();
  setTimeout(()=>{lastId=0},800);
  autoVerify();
  return body;
}
async function verify(){
  let prev='GENESIS';
  for(const e of ledger){
    const h=await sha(fp(e,prev));
    if(e.prev!==prev||e.hash!==h)return e.id;
    prev=e.hash;
  }
  return 0;
}
async function autoVerify(){
  const bad=await verify();
  setPill(bad?'BROKEN at #'+bad:'intact · '+ledger.length,bad?'bad':'ok');
}
function setPill(t,c){const p=$('pill');p.textContent='chain: '+t;p.className='pill '+(c||'')}

function toast(m,t){
  const d=document.createElement('div');d.className='toast '+(t||'');d.textContent=m;$('toasts').appendChild(d);
  setTimeout(()=>d.classList.add('out'),2600);setTimeout(()=>d.remove(),3100);
}
function setOrb(s){document.body.dataset.orb=s}
function pickVoice(){
  const vs=(window.speechSynthesis?speechSynthesis.getVoices():[]).filter(v=>/^en/i.test(v.lang));
  const pref=['Samantha','Ava','Allison','Serena','Karen','Moira','Google US English'];
  for(const p of pref){const v=vs.find(x=>x.name.indexOf(p)>-1);if(v)return v}
  return vs[0]||null;
}
function clean(t){return t.replace(/#(\d+)/g,'number $1').replace(/°F/g,' degrees').replace(/→/g,' ').replace(/Alexa\+/g,'Alexa plus')}
function speak(t){
  if(!S.voice||!window.speechSynthesis)return;
  try{
    const u=new SpeechSynthesisUtterance(clean(t));
    const v=pickVoice();if(v)u.voice=v;
    u.rate=1.02;u.pitch=1.06;
    u.onstart=()=>setOrb('speaking');
    u.onend=u.onerror=()=>{if(!speechSynthesis.speaking)setOrb('idle')};
    speechSynthesis.speak(u);
  }catch(e){}
}
async function idle(){
  await q;const t0=Date.now();
  while(window.speechSynthesis&&(speechSynthesis.speaking||speechSynthesis.pending)&&Date.now()-t0<20000)await sleep(150);
}
document.addEventListener('pointerdown',()=>{
  try{if(window.speechSynthesis){speechSynthesis.speak(new SpeechSynthesisUtterance(''))}}catch(e){}
},{once:true});

function addMsg(who,t){
  const d=document.createElement('div');d.className='msg '+who;d.textContent=t;
  $('chat').appendChild(d);$('chat').scrollTop=$('chat').scrollHeight;return d;
}
function say(who,t,spoken){
  q=q.then(async()=>{
    try{
      if(who==='me'){addMsg('me',t);return}
      const d=addMsg('ai','');
      d.innerHTML='<span class="dots"><i></i><i></i><i></i></span>';
      await sleep(420);
      d.textContent=t;$('chat').scrollTop=$('chat').scrollHeight;
      speak(spoken||t);
    }catch(e){}
  });
  return q;
}

function explain(id){
  const e=id?ledger.find(x=>x.id===id):ledger[ledger.length-1];
  if(!e){say('ai','I have not done anything yet.');return}
  const txt=`#${e.id} ${e.tool}. You said: "${e.request}". Why: ${e.reason} Status: ${e.status}${e.undone?' (later undone)':''}. Fingerprint ${e.hash.slice(0,10)}, chained to ${e.prev.slice(0,10)}.`;
  const spoken=`Number ${e.id}, ${e.tool.replace(/_/g,' ')}. You said: ${e.request}. ${e.reason}`;
  say('ai',txt,spoken);
}
async function doUndo(k){
  const c=[...ledger].reverse().filter(e=>e.status==='done'&&e.undo&&!e.undone).slice(0,k);
  if(!c.length){say('ai','There is nothing to undo.');return}
  for(const e of c){
    e.undo();e.undone=true;
    await record({tool:'undo_action',args:{target:e.id},request:'undo',reason:`Reversed #${e.id} (${e.tool}) at your request.`});
  }
  say('ai','Undone: '+c.map(e=>'#'+e.id+' '+e.tool.replace(/_/g,' ')).join(', ')+'.');
  render();
}
async function exec(p,confirmed){
  if(p.tool==='place_order'){
    const o={item:p.args.item,amount:p.args.amount};S.orders.push(o);
    await record({tool:'place_order',args:p.args,request:p.request,reason:p.reason+(confirmed?' You confirmed the spending hold.':''),undo:()=>{S.orders=S.orders.filter(x=>x!==o)}});
    say('ai',`Ordered ${o.item} for $${o.amount}.`);
  }
  if(p.tool==='set_thermostat'){
    const prev=S.thermo;S.thermo=p.args.temp;
    await record({tool:'set_thermostat',args:p.args,request:p.request,reason:p.reason,undo:()=>{S.thermo=prev}});
    say('ai',`Thermostat set to ${p.args.temp}°F.`);
  }
  if(p.tool==='add_event'){
    const ev={title:p.args.title};S.cal.push(ev);
    await record({tool:'add_event',args:p.args,request:p.request,reason:p.reason,undo:()=>{S.cal=S.cal.filter(x=>x!==ev)}});
    say('ai',`Added to your calendar: ${ev.title}.`);
  }
  render();
}
/* END */
