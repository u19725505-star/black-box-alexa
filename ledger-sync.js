(function(){
const panel=document.getElementById('p-ledger');
if(!panel)return;
const card=document.createElement('div');
card.className='card';
card.innerHTML='<h2>Ledger synchronization</h2><p>Browser and server ledgers are separate. Use Verify chain to check both.</p><div id="ledger-sync-status">Not checked yet.</div>';
panel.insertBefore(card,panel.firstChild);
const button=document.getElementById('verify');
if(button)button.onclick=async function(){
const el=document.getElementById('ledger-sync-status');
el.textContent='Checking both ledgers…';
try{
await mcpQ.catch(function(){return null});
const localBad=await verify();
const remote=await mcpCall('verify_chain',{});
const data=await mcpCall('list_ledger',{});
const rows=Array.isArray(data.entries)?data.entries:[];
const match=ledger.length===rows.length&&ledger.every((e,i)=>rows[i]&&e.id===rows[i].id&&e.tool===rows[i].tool&&e.status===rows[i].status);
el.textContent='Browser: '+(localBad?'BROKEN at #'+localBad:'intact, '+ledger.length+' entries')+'. Server: '+(remote.intact?'intact':'BROKEN at #'+remote.brokenAt)+', '+remote.entries+' entries. Sync: '+(match?'MATCH':'MISMATCH');
el.className=match?'sync-match':'sync-mismatch';
}catch(e){el.textContent='Remote verification unavailable: '+e.message;el.className='sync-mismatch'}
};
})();