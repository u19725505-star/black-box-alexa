(function(){
const panel=document.getElementById('p-ledger');
if(!panel)return;

const card=document.createElement('div');
card.className='card';
card.innerHTML='<h2>Ledger synchronization</h2><p>Browser and server ledgers are separate. Each chain is verified independently. Content sync compares the recorded action fields; independent timestamps and hashes are not expected to be identical.</p><div id="ledger-sync-status" role="status" aria-live="polite">Not checked yet.</div>';
panel.insertBefore(card,panel.firstChild);

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object'){
    const out={};
    Object.keys(value).sort().forEach(function(k){out[k]=stable(value[k]);});
    return out;
  }
  return value;
}
function sameValue(a,b){
  return JSON.stringify(stable(a))===JSON.stringify(stable(b));
}
function sameEntry(a,b){
  if(!a||!b)return false;
  return a.id===b.id&&a.tool===b.tool&&
    sameValue(a.args||{},b.args||{})&&
    a.request===b.request&&a.reason===b.reason&&
    a.status===b.status;
}
const button=document.getElementById('verify');
if(button){
  const priorVerify=button.onclick;
  button.onclick=async function(){
    const el=document.getElementById('ledger-sync-status');
    el.textContent='Checking both ledgers…';
    el.className='';
    try{
      if(typeof priorVerify==='function')await priorVerify();
      await mcpQ.catch(function(){return null;});
      const localBad=await verify();
      const remote=await mcpCall('verify_chain',{});
      const data=await mcpCall('list_ledger',{});
      const rows=Array.isArray(data.entries)?data.entries:[];
      const entriesMatch=ledger.length===rows.length&&ledger.every(function(e,i){return sameEntry(e,rows[i]);});
      const bothIntact=!localBad&&remote&&remote.intact===true;
      const match=bothIntact&&entriesMatch&&remote.entries===ledger.length&&rows.length===ledger.length;
      const browserStatus=localBad?'BROKEN at #'+localBad:'intact, '+ledger.length+' entries';
      const serverStatus=!remote||remote.intact!==true?'BROKEN'+(remote&&remote.brokenAt?' at #'+remote.brokenAt:'')+', '+(remote&&Number.isFinite(remote.entries)?remote.entries:'unknown')+' entries':'intact, '+remote.entries+' entries';
      el.textContent='Browser: '+browserStatus+'. Server: '+serverStatus+'. Content sync: '+(match?'MATCH':'MISMATCH')+'. Compared: id, tool, args, request, reason, status.';
      el.className=match?'sync-match':'sync-mismatch';
    }catch(e){
      el.textContent='Browser: verification attempted. MCP server: unavailable ('+String(e&&e.message||e)+'). Content sync: UNKNOWN.';
      el.className='sync-mismatch';
    }
  };
}
})();