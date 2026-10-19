const MCP_URL='https://black-box-alexa.onrender.com/mcp';
let mcpRid=0,mcpTools=[],mcpOnline=false;
const mcpLog=[];

function setMcpPill(t,c){
  const p=document.getElementById('mcp');
  if(p){p.textContent='MCP: '+t;p.className='pill '+(c||'')}
}
async function mcpRpc(method,params){
  const id=++mcpRid;
  const res=await fetch(MCP_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params:params||{}})
  });
  if(!res.ok)throw new Error('HTTP '+res.status);
  const ct=res.headers.get('content-type')||'';
  let msg;
  if(ct.includes('text/event-stream')){
    const txt=await res.text();
    const line=txt.split('\n').filter(l=>l.startsWith('data:')).pop();
    msg=JSON.parse(line.slice(5).trim());
  }else{
    msg=await res.json();
  }
  if(msg.error)throw new Error(msg.error.message||'MCP error');
  return msg.result;
}
async function mcpCall(name,args){
  const t0=performance.now();
  const r=await mcpRpc('tools/call',{name,arguments:args||{}});
  const text=r.content&&r.content[0]?r.content[0].text:'{}';
  mcpLog.unshift({name,ms:Math.round(performance.now()-t0),ts:new Date().toLocaleTimeString()});
  return JSON.parse(text);
}
async function mcpConnect(){
  setMcpPill('connecting…','');
  try{
    await mcpRpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'black-box-web',version:'1.0.0'}});
    const r=await mcpRpc('tools/list');
    mcpTools=r.tools||[];
    mcpOnline=true;
    setMcpPill('connected · '+mcpTools.length+' tools','ok');
    toast('MCP server connected: '+mcpTools.length+' tools','ok');
  }catch(e){
    mcpOnline=false;
    setMcpPill('offline','bad');
    toast('MCP server not reachable yet. Tap the MCP pill to retry.','bad');
  }
}
(function(){
  const h=document.querySelector('.hctl');
  if(!h)return;
  const s=document.createElement('span');
  s.id='mcp';s.className='pill';s.style.cursor='pointer';
  s.onclick=mcpConnect;
  h.insertBefore(s,h.firstChild);
  mcpConnect();
})();
/* END */
