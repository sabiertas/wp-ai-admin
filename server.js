import express from 'express';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initClient, isConnected, chat } from './lib/claude.js';
import { testConnection } from './lib/wp-cli.js';
import { matchSkills, listAvailableSkills } from './lib/wp-skills.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITES_PATH = join(__dirname, 'config', 'sites.json');
const HISTORY_PATH = join(__dirname, 'config', 'history.json');
const SKILLS_PATH = join(__dirname, 'config', 'skills.json');
const PORT = 3848;

// Load .env manually (no dotenv dependency)
try {
  const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) {
      const raw = vals.join('=').trim();
      process.env[key.trim()] = raw.replace(/^(['"])(.*)\1$/, '$2');
    }
  });
} catch { /* no .env file */ }

// Init Claude if API key exists
if (process.env.ANTHROPIC_API_KEY) {
  initClient(process.env.ANTHROPIC_API_KEY);
  console.log('  Claude API: connected');
} else {
  console.log('  Claude API: not configured (set ANTHROPIC_API_KEY in .env)');
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname, 'public')));

// ==================== SITES ====================
function readSites() {
  if (!existsSync(SITES_PATH)) {
    const initial = { sites: [] };
    writeFileSync(SITES_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(SITES_PATH, 'utf-8'));
}

function writeSites(data) {
  writeFileSync(SITES_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/sites', (req, res) => {
  res.json(readSites());
});

app.post('/api/sites', (req, res) => {
  const data = readSites();
  const site = {
    id: 'site-' + Date.now(),
    name: req.body.name || 'New Site',
    type: req.body.type || 'local',
    path: req.body.path || '',
    ssh_host: req.body.ssh_host || '',
    ssh_user: req.body.ssh_user || '',
    active: data.sites.length === 0 // first site is active by default
  };
  data.sites.push(site);
  writeSites(data);
  res.json({ ok: true, site });
});

app.put('/api/sites/:id', (req, res) => {
  const data = readSites();
  const idx = data.sites.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Site not found' });
  Object.assign(data.sites[idx], req.body);
  writeSites(data);
  res.json({ ok: true, site: data.sites[idx] });
});

app.delete('/api/sites/:id', (req, res) => {
  const data = readSites();
  data.sites = data.sites.filter(s => s.id !== req.params.id);
  writeSites(data);
  res.json({ ok: true });
});

app.post('/api/sites/:id/activate', (req, res) => {
  const data = readSites();
  data.sites.forEach(s => s.active = (s.id === req.params.id));
  writeSites(data);
  res.json({ ok: true });
});

app.post('/api/sites/:id/test', async (req, res) => {
  const data = readSites();
  const site = data.sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  const result = await testConnection(site);
  res.json(result);
});

// ==================== SCAN SITES ====================
app.post('/api/sites/scan', (req, res) => {
  const { basePath } = req.body;
  if (!basePath || !existsSync(basePath)) {
    return res.status(400).json({ error: 'Ruta no valida', sites: [] });
  }
  const found = [];
  try {
    const entries = readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const wpConfig = join(basePath, entry.name, 'wp-config.php');
        if (existsSync(wpConfig)) {
          found.push({ name: entry.name, path: join(basePath, entry.name) });
        }
      }
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, sites: [] });
  }
  res.json({ sites: found });
});

// ==================== CHAT ====================
// In-memory conversation store (per session, resets on restart)
const conversations = {};
const MAX_CONVERSATIONS = 50;

app.post('/api/chat', async (req, res) => {
  // Workflows can chain many tool calls — allow up to 5 min
  req.setTimeout(300000);
  res.setTimeout(300000);

  try {
    if (!isConnected()) {
      return res.status(400).json({ error: 'Claude API not connected. Set your API key in Settings.' });
    }

    const { message, conversationId } = req.body;
    const convId = conversationId || 'default';

    // Get active site
    const sitesData = readSites();
    const activeSite = sitesData.sites.find(s => s.active);
    if (!activeSite) {
      return res.status(400).json({ error: 'No active site selected. Add a site in Settings.' });
    }

    // Build messages history
    if (!conversations[convId]) {
      const keys = Object.keys(conversations);
      if (keys.length >= MAX_CONVERSATIONS) delete conversations[keys[0]];
      conversations[convId] = [];
    }
    conversations[convId].push({ role: 'user', content: message });

    const result = await chat(conversations[convId], activeSite);

    // Update conversation with full message history from Claude
    conversations[convId] = result.messages;

    // Save to history
    saveToHistory(convId, activeSite.name, message, result);

    res.json({
      text: result.text,
      toolResults: result.toolResults,
      site: activeSite.name
    });
  } catch (e) {
    console.error('[chat error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chat/reset', (req, res) => {
  const { conversationId } = req.body;
  delete conversations[conversationId || 'default'];
  res.json({ ok: true });
});

// ==================== STATUS ====================
app.get('/api/status', (req, res) => {
  const sitesData = readSites();
  const wpSkills = listAvailableSkills();
  res.json({
    claude: isConnected(),
    sites: sitesData.sites.length,
    activeSite: sitesData.sites.find(s => s.active) || null,
    wpAgentSkills: wpSkills.length
  });
});

// ==================== WP AGENT SKILLS ====================
app.get('/api/wp-skills', (req, res) => {
  res.json({ skills: listAvailableSkills() });
});

app.post('/api/wp-skills/match', (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ matched: [] });
  const matched = matchSkills(message);
  const allSkills = listAvailableSkills();
  const details = matched.map(name => allSkills.find(s => s.id === name)).filter(Boolean);
  res.json({ matched: details });
});

// ==================== API KEY ====================
app.post('/api/settings/apikey', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: 'API key required' });

  const key = apiKey.trim();

  // Save to .env
  const envPath = join(__dirname, '.env');
  writeFileSync(envPath, `ANTHROPIC_API_KEY=${key}\n`);
  process.env.ANTHROPIC_API_KEY = key;
  initClient(key);
  res.json({ ok: true, connected: true });
});

// ==================== HISTORY ====================
function saveToHistory(convId, siteName, userMessage, result) {
  try {
    let history = {};
    if (existsSync(HISTORY_PATH)) {
      history = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
    }
    if (!history.entries) history.entries = [];
    history.entries.push({
      date: new Date().toISOString(),
      site: siteName,
      message: userMessage,
      toolsUsed: result.toolResults.map(t => t.name),
      commands: result.toolResults.map(t => t.command).filter(Boolean)
    });
    // Keep last 500
    if (history.entries.length > 500) history.entries = history.entries.slice(-500);
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch { /* non-critical */ }
}

app.get('/api/history', (req, res) => {
  try {
    if (!existsSync(HISTORY_PATH)) return res.json({ entries: [] });
    res.json(JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')));
  } catch { res.json({ entries: [] }); }
});

// ==================== SKILLS ====================
function readSkills() {
  if (!existsSync(SKILLS_PATH)) return { skills: [] };
  return JSON.parse(readFileSync(SKILLS_PATH, 'utf-8'));
}

function writeSkills(data) {
  writeFileSync(SKILLS_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/skills', (req, res) => {
  res.json(readSkills());
});

app.post('/api/skills', (req, res) => {
  const data = readSkills();
  const skill = {
    id: req.body.id || 'skill-' + Date.now(),
    name: req.body.name || 'New Skill',
    icon: req.body.icon || '⚙️',
    description: req.body.description || '',
    prompt: req.body.prompt || '',
    category: req.body.category || 'custom'
  };
  data.skills.push(skill);
  writeSkills(data);
  res.json({ ok: true, skill });
});

app.put('/api/skills/:id', (req, res) => {
  const data = readSkills();
  const idx = data.skills.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Skill not found' });
  Object.assign(data.skills[idx], req.body);
  writeSkills(data);
  res.json({ ok: true, skill: data.skills[idx] });
});

app.delete('/api/skills/:id', (req, res) => {
  const data = readSkills();
  data.skills = data.skills.filter(s => s.id !== req.params.id);
  writeSkills(data);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`\n  WP AI Admin → http://localhost:${PORT}\n  Sites: ${SITES_PATH}\n  Skills: ${readSkills().skills.length} loaded\n  Claude: ${isConnected() ? 'connected' : 'not configured'}\n`));
