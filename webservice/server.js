// server.js - Express backend + optional Discord gateway client for AI /chat
const express = require('express');
const fetch = require('node-fetch');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const { Client, GatewayIntentBits, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

function botAuthHeader(token) {
  if (!token) return null;
  if (token.startsWith('Bot ') || token.startsWith('Bearer ')) return token;
  return `Bot ${token}`;
}

async function discordGet(path, token) {
  const auth = botAuthHeader(token);
  if (!auth) throw new Error('No token provided');
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: 'GET',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Discord API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function discordPost(path, token, body) {
  const auth = botAuthHeader(token);
  if (!auth) throw new Error('No token provided');
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch(e){ parsed = txt; }
  if (!res.ok) {
    const err = new Error(`Discord API ${res.status}: ${JSON.stringify(parsed)}`);
    err.status = res.status;
    throw err;
  }
  return parsed;
}

// Endpoint: prove a bot token by returning /users/@me
app.post('/api/prove', async (req, res) => {
  const token = req.body.token;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const data = await discordGet('/users/@me', token);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Fetch guilds for a token
app.post('/api/guilds', async (req, res) => {
  const token = req.body.token || null;
  const finalToken = token || process.env.BOT_TOKEN || null;
  try {
    const data = await discordGet('/users/@me/guilds', finalToken);
    res.json(data.map(g => ({ id: g.id, name: g.name, owner: g.owner })));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Fetch channels for a guild
app.post('/api/channels', async (req, res) => {
  const token = req.body.token || null;
  const guildId = req.body.guildId;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const finalToken = token || process.env.BOT_TOKEN || null;
  try {
    const data = await discordGet(`/guilds/${guildId}/channels`, finalToken);
    const filtered = data.filter(c => [0,5,10,11,13].includes(c.type) || ['GUILD_TEXT'].includes(c.type)).map(c => ({ id: c.id, name: c.name, type: c.type }));
    res.json(filtered);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Send message
app.post('/api/send', async (req, res) => {
  const token = req.body.token || null;
  const channelId = req.body.channelId;
  const content = req.body.content || '';
  const embeds = req.body.embeds || null;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const finalToken = token || process.env.BOT_TOKEN || null;
  try {
    const payload = {};
    if (content) payload.content = content;
    if (embeds) payload.embeds = embeds;
    if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'content or embeds required' });
    const data = await discordPost(`/channels/${channelId}/messages`, finalToken, payload);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Change nickname (PATCH /guilds/{guild.id}/members/@me)
app.post('/api/change-nick', async (req, res) => {
  const token = req.body.token || null;
  const guildId = req.body.guildId;
  const nick = req.body.nick;
  if (!guildId || typeof nick === 'undefined') return res.status(400).json({ error: 'guildId and nick required' });
  const finalToken = token || process.env.BOT_TOKEN || null;
  try {
    const data = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
      method: 'PATCH',
      headers: { 'Authorization': botAuthHeader(finalToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick })
    });
    const txt = await data.text();
    if (!data.ok) return res.status(data.status).json({ error: txt });
    res.json(JSON.parse(txt || '{}'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Generate invite link for a client id (bot B)
app.post('/api/generate-invite', async (req, res) => {
  const clientId = req.body.clientId;
  const permissions = req.body.permissions || '268435456'; // default: Manage Roles? use 8 for admin if wanted
  if (!clientId) return res.status(400).json({ error: 'clientId required' });
  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=${permissions}&response_type=code`;
  res.json({ invite: url });
});

// Post invite link into a channel using token A
app.post('/api/post-invite', async (req, res) => {
  const tokenA = req.body.tokenA; // sender bot
  const channelId = req.body.channelId;
  const inviteLink = req.body.inviteLink;
  if (!tokenA || !channelId || !inviteLink) return res.status(400).json({ error: 'tokenA, channelId, inviteLink required' });
  try {
    const data = await discordPost(`/channels/${channelId}/messages`, tokenA, { content: `Invite link: ${inviteLink}` });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- AI /chat feature ---
const SERVER_BOT_TOKEN = process.env.BOT_TOKEN || null;
const OPENAI_KEY = process.env.OPENAI_API_KEY || null;
let discordClient = null;
let openai = null;

if (SERVER_BOT_TOKEN && OPENAI_KEY) {
  console.log('Starting Discord client for AI /chat...');
  openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_KEY }));
  discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

  discordClient.on('ready', () => {
    console.log('Discord client ready as', discordClient.user.tag);
  });

  discordClient.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === 'chat') {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();
        const resp = await openai.createChatCompletion({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] });
        const reply = resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message ? resp.data.choices[0].message.content : 'No response';
        await interaction.editReply(reply);
      }
    } catch (e) {
      console.error('interaction error', e);
      try { if (interaction.deferred || interaction.replied) await interaction.editReply('Error: ' + e.message); else await interaction.reply('Error: ' + e.message); } catch(_){}
    }
  });

  discordClient.login(SERVER_BOT_TOKEN).catch(err => console.error('Discord login failed:', err));
} else {
  console.log('AI /chat feature not enabled: BOT_TOKEN and OPENAI_API_KEY required in .env');
}

// Register /chat command for a guild using provided bot token (will register globally if no guildId provided)
app.post('/api/register-chat', async (req, res) => {
  const token = req.body.token || process.env.BOT_TOKEN || null; // token used to register command
  const guildId = req.body.guildId || null;
  if (!token) return res.status(400).json({ error: 'token required to register command' });
  const auth = botAuthHeader(token);
  const commands = [{ name: 'chat', description: 'Ask the AI a question', options: [{ name: 'prompt', description: 'Your prompt', type: 3, required: true }] }];
  try {
    const rest = new REST({ version: '10' }).setToken(auth.replace(/^Bot\s+/, ''));
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands((await discordGet('/users/@me', token)).id, guildId), { body: commands });
      res.json({ ok: true, registered: 'guild' });
    } else {
      await rest.put(Routes.applicationCommands((await discordGet('/users/@me', token)).id), { body: commands });
      res.json({ ok: true, registered: 'global' });
    }
  } catch (err) {
    console.error('register command err', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// fallback
app.get('*', (req, res) => res.sendFile(require('path').resolve(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
