const MCP_URL='https://black-box-alexa.onrender.com/mcp';
let mcpRid=0,mcpTools=[],mcpOnline=false,mcpQ=Promise.resolve();
const mcpFeed=[];

function setMcpPill(t,c){
  const p=document.getElementById('mcp');
  if(p){p.textContent='MCP: '+t;p.className='pill '+(c||'')}
  const s=document.getElementById('mcp-connect-status');
  if(s){s.textContent=t;s.className='connect-status '+(c||'')}
  const orb=document.querySelector('.connect-orb');
  if(orb)orb.classList.toggle('connected',!!c&&c.includes('ok'));
}
function summ(name,r){
  try{
    if(name==='record_action')return '#'+r.entry.id+' '+r.entry.status+' · hash '+r.entry.hash.slice(0,8);
    if(name==='check_action')return r.decision+': '+r.reason;
    if(name==='verify_chain')return r.intact?'intact ('+r.entries+' entries)':'BROKEN at entry #'+r.brokenAt;
    if(name==='undo_action')return 'undid '+(r.undone.length?r.undone.map(function(u){return '#'+u.id}).join(', '):'nothing');
    if(name==='explain_action')return r.found?'found #'+r.entry.id+' '+r.entry.tool:'not found';
    if(name==='set_guardrail')return 'limit $'+r.guardrails.limit+', quiet hours '+(r.guardrails.quiet?'on':'off');
    if(name==='demo_tamper')return r.tampered?'edited entry #'+r.id+' without re-hashing':'nothing to edit';
    if(name==='demo_reset')return 'server ledger cleared';
  }catch(e){}
  return 'ok';
}
function renderFeed(){
  const el=document.getElementById('mcpfeed');
  if(!el)return;
  el.innerHTML=mcpFeed.length?mcpFeed.map(function(f){
    return '<div class="ent '+(f.ok?'':'blocked')+'"><div class="eh"><b>'+esc(f.name)+'</b><span class="tag">'+(f.ok?'ok':'failed')+'</span><span class="t">'+esc(f.ts)+' · '+f.ms+' ms</span></div><div class="rq">'+esc(f.note||'')+'</div></div>';
  }).join(''):'<div class="empty">No MCP calls yet.</div>';
}
function feedAdd(name,ms,ok,note){
  mcpFeed.unshift({name:name,ms:ms,ok:ok,note:note,ts:new Date().toLocaleTimeString()});
  if(mcpFeed.length>14)mcpFeed.pop();
  renderFeed();
}
async function mcpRpc(method,params){
  const id=++mcpRid;
  const res=await fetch(MCP_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},
    body:JSON.stringify({jsonrpc:'2.0',id:id,method:method,params:params||{}})
  });
  if(!res.ok)throw new Error('HTTP '+res.status);
  const ct=res.headers.get('content-type')||'';
  let msg;
  if(ct.includes('text/event-stream')){
    const txt=await res.text();
    const line=txt.split('\n').filter(function(l){return l.startsWith('data:')}).pop();
    msg=JSON.parse(line.slice(5).trim());
  }else{
    msg=await res.json();
  }
  if(msg.error)throw new Error(msg.error.message||'MCP error');
  return msg.result;
}
async function mcpCall(name,args){
  const t0=performance.now();
  try{
    const r=await mcpRpc('tools/call',{name:name,arguments:args||{}});
    const obj=JSON.parse(r.content&&r.content[0]?r.content[0].text:'{}');
    feedAdd(name,Math.round(performance.now()-t0),true,summ(name,obj));
    if(!mcpOnline){mcpOnline=true;setMcpPill('connected · '+(mcpTools.length||'9')+' tools','ok')}
    return obj;
  }catch(e){
    feedAdd(name,Math.round(performance.now()-t0),false,e.message);
    throw e;
  }
}
function mcpQueue(name,args){
  const p=mcpQ.then(function(){return mcpCall(name,args)}).catch(function(){return null});
  mcpQ=p;
  return p;
}
/* Queue policy checks behind earlier guardrail updates. Fail closed if the server cannot decide. */
function mcpAuthorize(tool,args,confirmed){
  const p=mcpQ.then(function(){
    return mcpCall('check_action',{
      tool:tool,
      amount:tool==='place_order'&&args?args.amount:undefined,
      night:tool==='set_thermostat'?!!S.night:undefined,
      approved:!!confirmed
    });
  });
  mcpQ=p.catch(function(){return null});
  return p;
}
async function mcpConnect(){
  const btn=document.getElementById('mcp-connect-button');
  const retry=document.getElementById('mcp-retry-button');
  if(btn){btn.disabled=true;btn.textContent='Connecting…'}
  if(retry)retry.hidden=true;
  setMcpPill('Connecting to hosted MCP server…','');
  try{
    const init=await mcpRpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'black-box-web',version:'1.0.0'}});
    const r=await mcpRpc('tools/list');
    mcpTools=r.tools||[];
    mcpOnline=true;
    setMcpPill('Connected · '+mcpTools.length+' tools','ok');
    const count=document.getElementById('mcp-tool-count');
    if(count)count.textContent=mcpTools.length+' tools discovered';
    const protocol=document.getElementById('mcp-protocol-label');
    if(protocol)protocol.textContent='Protocol '+(init.protocolVersion||'negotiated');
    const wrap=document.getElementById('mcp-tools-wrap');
    const list=document.getElementById('mcp-tools-list');
    if(wrap)wrap.hidden=false;
    if(list)list.innerHTML=mcpTools.map(function(t){
      return '<div class="mcp-tool"><span class="tool-mark">↗</span><div><strong>'+esc(t.name)+'</strong><small>'+esc(t.description||'Remote MCP tool')+'</small></div></div>';
    }).join('');
    if(btn){btn.textContent='Connected';btn.disabled=true}
    toast('Connected to remote MCP server · '+mcpTools.length+' tools discovered','ok');
  }catch(e){
    mcpOnline=false;
    setMcpPill('Connection failed · '+e.message,'bad');
    if(btn){btn.disabled=false;btn.textContent='Connect to MCP server'}
    if(retry)retry.hidden=false;
    const count=document.getElementById('mcp-tool-count');
    if(count)count.textContent='No tools loaded';
    toast('Could not connect to the MCP server. Check the service and retry.','bad');
  }
}

/* ---- mirror the app's actions to the live MCP server ---- */
const _record=record;
record=async function(e){
  const b=await _record(e);
  if(e&&e.localOnly)return b;
  try{
    if(b.tool==='set_guardrail'){mcpQueue('set_guardrail',b.args||{})}
    else if(b.tool==='undo_action'){mcpQueue('undo_action',{count:1})}
    else{mcpQueue('record_action',{tool:b.tool,args:b.args||{},request:b.request,reason:b.reason,status:b.status})}
  }catch(x){}
  return b;
};
const _explain=explain;
explain=function(id){mcpQueue('explain_action',id?{id:id}:{});return _explain(id)};
const _runVerify=runVerify;
runVerify=function(){mcpQueue('verify_chain',{});return _runVerify()};
const _tamper=tamper;
tamper=function(){mcpQueue('demo_tamper',{});return _tamper()};
const _resetAll=resetAll;
resetAll=function(silent){mcpQueue('demo_reset',{});return _resetAll(silent)};
document.getElementById('verify').onclick=runVerify;
document.getElementById('tamper').onclick=tamper;

(function(){
  const h=document.querySelector('.hctl');
  if(h){
    const s=document.createElement('span');
    s.id='mcp';s.className='pill';s.textContent='MCP: not connected';
    h.insertBefore(s,h.firstChild);
  }
  const connect=document.getElementById('mcp-connect-button');
  const retry=document.getElementById('mcp-retry-button');
  if(connect)connect.addEventListener('click',mcpConnect);
  if(retry)retry.addEventListener('click',mcpConnect);
  const copy=document.getElementById('copyMcpUrl');
  if(copy)copy.addEventListener('click',async function(){
    try{await navigator.clipboard.writeText(MCP_URL);toast('MCP endpoint copied','ok')}
    catch(e){toast('Endpoint: '+MCP_URL)}
  });
  const led=document.getElementById('p-ledger');
  if(led){
    const c=document.createElement('div');
    c.className='card';
    c.innerHTML='<h2>MCP traffic (live server calls)</h2><div id="mcpfeed"></div>';
    led.appendChild(c);
  }
  renderFeed();
})();
/* END */
