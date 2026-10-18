async function act(text){
  let t=String(text||'').trim().replace(/^(hey |hi )?alexa[,.\s]+/i,'');
  if(!t)return;
  say('me',t);
  const l=t.toLowerCase();
  if(S.pending&&/^(yes|confirm|go ahead|approve)/.test(l)){const p=S.pending;S.pending=null;return exec(p,true)}
  if(S.pending&&/^(no|cancel|deny)/.test(l)){
    const p=S.pending;S.pending=null;
    await record({tool:p.tool,args:p.args,request:p.request,reason:'Held by your spending guardrail and you declined.',status:'declined'});
    return say('ai','Okay, I cancelled it.');
  }
  if(/undo/.test(l)){
    const w={one:1,two:2,three:3,four:4,five:5};
    const m=l.match(/(\d+)|\b(one|two|three|four|five)\b/);
    return doUndo(m?(m[1]?+m[1]:w[m[2]]):1);
  }
  if(/\b(why|explain)\b/.test(l)){
    const m=l.match(/#(\d+)/);
    return explain(m?+m[1]:0);
  }
  if(/history|summary|recap|what (did|have) you (do|done)/.test(l)){
    const done=ledger.filter(e=>e.status==='done'&&e.tool!=='undo_action').length;
    const held=ledger.filter(e=>e.status==='held').length;
    const blocked=ledger.filter(e=>e.status==='blocked').length;
    return say('ai',`So far I completed ${done} action${done===1?'':'s'}, held ${held} for approval, and blocked ${blocked}. Every one is in the ledger.`);
  }
  const lim=l.match(/(?:limit|ask me before spending over)\D*(\d+)/);
  if(lim){
    S.limit=+lim[1];
    await record({tool:'set_guardrail',args:{limit:S.limit},request:t,reason:`You set the spending limit to $${S.limit}.`});
    return say('ai',`Got it. I will ask before spending over $${S.limit}.`);
  }
  if(/quiet hours/.test(l)){
    S.quiet=!/off/.test(l);
    await record({tool:'set_guardrail',args:{quiet:S.quiet},request:t,reason:`You turned quiet hours ${S.quiet?'on':'off'}.`});
    return say('ai',`Quiet hours are ${S.quiet?'on':'off'}.`);
  }
  if(/thermostat|temperature|degrees/.test(l)){
    const m=l.match(/(\d{2})/);const temp=m?+m[1]:68;
    if(S.quiet&&S.night){
      await record({tool:'set_thermostat',args:{temp},request:t,reason:'Blocked by your quiet-hours guardrail (no thermostat changes at night).',status:'blocked'});
      return say('ai','I did not change it. Your quiet-hours guardrail blocks thermostat changes at night.');
    }
    return exec({tool:'set_thermostat',args:{temp},request:t,reason:`You asked for ${temp}°F. No guardrail applied.`});
  }
  if(/\b(order|buy)\b/.test(l)){
    const m=t.match(/\$\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:dollars?|bucks)/i);
    const amount=m?+(m[1]||m[2]):20;
    const item=t.replace(/\$\s?\d+(\.\d+)?|\d+(\.\d+)?\s*(dollars?|bucks)/ig,'').replace(/^(please\s+)?(order|buy)\s*/i,'').replace(/\s+for\s*$/i,'').trim()||'groceries';
    const p={tool:'place_order',args:{item,amount},request:t,reason:`You asked me to buy ${item}. Total $${amount} is within your $${S.limit} limit.`};
    if(amount>S.limit){
      S.pending=p;
      await record({tool:'place_order',args:{item,amount},request:t,reason:`Total $${amount} is over your $${S.limit} limit, so I paused for your approval.`,status:'held'});
      return say('ai',`That is $${amount}, over your $${S.limit} limit. Say "confirm" to approve or "cancel".`);
    }
    return exec(p);
  }
  if(/book|schedule|calendar/.test(l)){
    const title=t.replace(/^(please\s+)?(book|schedule|add)\s*/i,'')||'Event';
    return exec({tool:'add_event',args:{title},request:t,reason:'You asked me to put this on your calendar.'});
  }
  say('ai','Try: order groceries $18, order headphones $79, set thermostat to 66, book dinner Friday 7pm, why did you do that, undo the last 2, or recap.');
}

async function narrate(t){say('ai',t);await idle();await sleep(250)}
async function step(cmd,pause){await act(cmd);await idle();await sleep(pause||700)}
async function demo(){
  if(running)return;
  running=true;$('demo').disabled=true;$('demo').textContent='Running…';
  try{
    resetAll(true);setTab('assistant');await sleep(400);
    await narrate('Meet Black Box, a flight recorder and undo layer for agentic assistants. Watch what happens when Alexa plus acts on my behalf.');
    await step('Order groceries $18');
    await step('Order headphones $79');
    await narrate('That one is over my twenty five dollar limit, so it paused and asked me first.');
    await step('confirm');
    await step('Set thermostat to 66');
    await step('Book dinner Friday 7pm');
    setTab('ledger');
    await narrate('Every action is chained to the one before it with a cryptographic hash.');
    setTab('assistant');
    await step('Why did you do that?',900);
    await step('Undo the last 2',900);
    setTab('home');
    await narrate('The thermostat and calendar are back where they started, and the undo itself is logged.');
    setTab('rails');await sleep(500);
    S.night=true;render();toast('Simulated time: 11:00 PM');
    await narrate('Now it is eleven p m, and my quiet hours guardrail is on.');
    setTab('assistant');
    await step('Set thermostat to 66',900);
    setTab('ledger');await runVerify();await idle();
    await narrate('Now someone edits an old record after the fact.');
    tamper();await sleep(400);await runVerify();await idle();
    await narrate('Verification catches it instantly. Black Box: see it, explain it, undo it.');
  }catch(e){console.error(e)}
  finally{running=false;$('demo').disabled=false;$('demo').textContent='▶ Run demo'}
}

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let rec=null,listening=false;
function mic(){
  if(!SR){toast('Speech recognition is not supported in this browser','bad');return}
  if(listening&&rec){rec.stop();return}
  try{if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}
  rec=new SR();rec.lang='en-US';rec.interimResults=false;rec.maxAlternatives=1;
  rec.onstart=()=>{listening=true;setOrb('listening');$('mic').classList.add('on')};
  rec.onend=()=>{listening=false;setOrb('idle');$('mic').classList.remove('on')};
  rec.onerror=()=>{toast('Could not hear that. Try again.','bad')};
  rec.onresult=e=>{const t=e.results[0][0].transcript;setTab('assistant');act(t)};
  try{rec.start()}catch(e){}
}

function submit(){const v=$('inp').value;$('inp').value='';act(v)}
$('send').onclick=submit;
$('inp').addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
$('mic').onclick=mic;
$('demo').onclick=demo;
$('vbtn').onclick=()=>{
  S.voice=!S.voice;$('vbtn').textContent=S.voice?'🔊':'🔇';
  if(!S.voice&&window.speechSynthesis)speechSynthesis.cancel();
  toast('Voice '+(S.voice?'on':'off'));
};
$('verify').onclick=runVerify;
$('tamper').onclick=tamper;
$('reset').onclick=()=>resetAll(false);
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.tab)});
$('strip').addEventListener('click',e=>{const c=e.target.closest('.blk');if(c){open[c.dataset.id]=true;setTab('ledger');renderLedger()}});
$('filters').addEventListener('click',e=>{const b=e.target.closest('button');if(b){filter=b.dataset.f;renderStats();renderLedger()}});
$('ledger').addEventListener('click',e=>{
  const w=e.target.closest('[data-why]'),t=e.target.closest('[data-tog]');
  if(w){setTab('assistant');explain(+w.dataset.why)}
  if(t){open[t.dataset.tog]=!open[t.dataset.tog];renderLedger()}
});
$('lim').addEventListener('input',()=>{$('limv').textContent='$'+$('lim').value});
$('lim').addEventListener('change',()=>{
  S.limit=+$('lim').value;
  record({tool:'set_guardrail',args:{limit:S.limit},request:'Changed in Guardrails tab',reason:`You set the spending limit to $${S.limit}.`});
});
$('qh').addEventListener('change',()=>{
  S.quiet=$('qh').checked;
  record({tool:'set_guardrail',args:{quiet:S.quiet},request:'Changed in Guardrails tab',reason:`You turned quiet hours ${S.quiet?'on':'off'}.`});
});
$('nt').addEventListener('change',()=>{S.night=$('nt').checked;render();toast('Simulated time: '+(S.night?'11:00 PM':'3:00 PM'))});
['Order groceries $18','Order headphones $79','confirm','Set thermostat to 66','Book dinner Friday 7pm','Why did you do that?','Undo the last 2','Recap'].forEach(c=>{
  const b=document.createElement('button');b.textContent=c;b.onclick=()=>act(c);$('chips').appendChild(b);
});
window.addEventListener('resize',moveInd);
resetAll(false);
setTimeout(moveInd,100);
function mic2(){
  if(!SR){toast('Voice input is not supported here. Use the keyboard microphone key instead.','bad');return}
  if(listening&&rec){try{rec.stop()}catch(e){}return}
  try{if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}
  const r=new SR();
  rec=r;
  r.lang='en-US';r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
  let finalText='';
  r.onstart=()=>{listening=true;setOrb('listening');$('mic').classList.add('on');toast('Listening… speak now')};
  r.onresult=e=>{
    let t='';
    for(let i=0;i<e.results.length;i++){t+=e.results[i][0].transcript}
    $('inp').value=t;
    if(e.results[e.results.length-1].isFinal)finalText=t;
  };
  r.onerror=e=>{
    const m={
      'not-allowed':'Microphone blocked. Allow it for this site in Safari, then reload.',
      'service-not-allowed':'Speech service is off. Turn on Dictation and Siri in Settings.',
      'no-speech':'No speech detected. Tap the mic and speak right away.',
      'audio-capture':'No microphone found.',
      'network':'Speech needs an internet connection.',
      'aborted':'Listening stopped.',
      'language-not-supported':'Language not supported.'
    };
    toast(m[e.error]||('Voice error: '+e.error),'bad');
  };
  r.onend=()=>{
    listening=false;setOrb('idle');$('mic').classList.remove('on');
    const t=(finalText||$('inp').value||'').trim();
    if(t){$('inp').value='';setTab('assistant');act(t)}
  };
  try{r.start()}catch(err){toast('Could not start the microphone: '+err.message,'bad')}
}
$('mic').onclick=mic2;
/* END */
