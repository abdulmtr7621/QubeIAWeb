const $ = id => document.getElementById(id);
async function post(path, body){
  const r = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const txt = await r.text(); try { return JSON.parse(txt); } catch(e){ return txt; }
}

$('proveA').onclick = async ()=>{
  $('proveAResult').textContent = '...';
  const token = $('tokenA').value.trim();
  const res = await post('/api/prove', { token });
  $('proveAResult').textContent = JSON.stringify(res, null, 2);
};
$('proveB').onclick = async ()=>{
  $('proveBResult').textContent = '...';
  const token = $('tokenB').value.trim();
  const res = await post('/api/prove', { token });
  $('proveBResult').textContent = JSON.stringify(res, null, 2);
};

$('fetchGuilds').onclick = async ()=>{
  $('result').textContent='...';
  const token = $('tokenA').value.trim();
  const res = await post('/api/guilds', { token });
  if (res.error) { $('result').textContent = JSON.stringify(res); return; }
  const sel = $('guilds'); sel.innerHTML=''; res.forEach(g=>{ const o=document.createElement('option'); o.value=g.id; o.textContent=g.name+' ('+g.id+')'; sel.appendChild(o); });
  $('result').textContent = 'Fetched '+res.length+' guilds';
};

$('fetchChannels').onclick = async ()=>{
  $('result').textContent='...';
  const token = $('tokenA').value.trim();
  const guildId = $('guilds').value;
  const res = await post('/api/channels', { token, guildId });
  if (res.error) { $('result').textContent = JSON.stringify(res); return; }
  const sel = $('channels'); sel.innerHTML=''; res.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=(c.name||'(chan)')+' — '+c.id; sel.appendChild(o); });
  $('result').textContent = 'Fetched '+res.length+' channels';
};

$('sendMsg').onclick = async ()=>{
  const token = $('tokenA').value.trim();
  const channelId = $('channels').value;
  const content = $('message').value;
  const res = await post('/api/send', { token, channelId, content });
  $('result').textContent = JSON.stringify(res, null, 2);
};

$('genInvite').onclick = async ()=>{
  const clientId = $('clientIdB').value.trim();
  const permissions = $('permissions').value.trim();
  const res = await post('/api/generate-invite', { clientId, permissions });
  $('inviteResult').textContent = JSON.stringify(res, null, 2);
};

$('postInvite').onclick = async ()=>{
  const tokenA = $('tokenA').value.trim();
  const channelId = $('channels').value;
  const inv = JSON.parse($('inviteResult').textContent || '{}').invite;
  const res = await post('/api/post-invite', { tokenA, channelId, inviteLink: inv });
  $('result').textContent = JSON.stringify(res, null, 2);
};

$('changeNick').onclick = async ()=>{
  const token = $('tokenA').value.trim();
  const guildId = $('guilds').value;
  const nick = $('newNick').value;
  const res = await post('/api/change-nick', { token, guildId, nick });
  $('changeNickResult').textContent = JSON.stringify(res, null, 2);
};

$('regChat').onclick = async ()=>{
  const token = $('regToken').value.trim() || null;
  const guildId = $('regGuild').value.trim() || null;
  const res = await post('/api/register-chat', { token, guildId });
  $('regChatResult').textContent = JSON.stringify(res, null, 2);
};
