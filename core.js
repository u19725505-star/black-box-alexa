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
['click','touchend','keydown'].forEach(function(ev){
  document.addEventListener(ev,function(){
    try{
      if(!window.speechSynthesis||speechSynthesis.speaking||speechSynthesis.pending)return;
      var u=new SpeechSynthesisUtterance(' ');
      u.volume=0;
      speechSynthesis.speak(u);
    }catch(e){}
  },true);
}); 
function sha256sync(str){
  var enc=new TextEncoder().encode(str);
  var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var l=enc.length;
  var padLen=((l+9+63)>>6)<<6;
  var m=new Uint8Array(padLen);
  m.set(enc);
  m[l]=0x80;
  var dv=new DataView(m.buffer);
  dv.setUint32(padLen-8,Math.floor(l/0x20000000));
  dv.setUint32(padLen-4,(l<<3)>>>0);
  var w=new Uint32Array(64);
  function rotr(x,n){return (x>>>n)|(x<<(32-n))}
  for(var off=0;off<padLen;off+=64){
    var i;
    for(i=0;i<16;i++)w[i]=dv.getUint32(off+i*4);
    for(i=16;i<64;i++){
      var s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);
      var s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(i=0;i<64;i++){
      var S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      var ch=(e&f)^(~e&g);
      var t1=(h+S1+ch+K[i]+w[i])>>>0;
      var S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      var mj=(a&b)^(a&c)^(b&c);
      var t2=(S0+mj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return H.map(function(x){return x.toString(16).padStart(8,'0')}).join('');
}
function sha(s){return Promise.resolve(sha256sync(s))}
function speak(t){
  if(!S.voice||!window.speechSynthesis)return;
  try{
    if(speechSynthesis.paused)speechSynthesis.resume();
    const u=new SpeechSynthesisUtterance(clean(t));
    const v=pickVoice();if(v)u.voice=v;
    u.rate=1.02;u.pitch=1.06;
    u.onstart=()=>setOrb('speaking');
    u.onend=()=>{if(!speechSynthesis.speaking)setOrb('idle')};
    u.onerror=e=>{
      setOrb('idle');
      if(e.error&&e.error!=='interrupted'&&e.error!=='canceled')toast('Voice blocked: '+e.error,'bad');
    };
    speechSynthesis.speak(u);
  }catch(e){}
}
