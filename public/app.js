// WP AI Admin — Frontend Logic

let state = {
  sites: [],
  activeSite: null,
  claudeConnected: false,
  loading: false
};

// ==================== INIT ====================
async function init() {
  await refreshStatus();
  await loadSites();
  await loadSkills();
  setupTypeToggle();
}

async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.claudeConnected = data.claude;
    state.activeSite = data.activeSite;

    const dot = document.getElementById('claude-dot');
    const text = document.getElementById('claude-text');
    if (data.claude) {
      dot.className = 'w-2 h-2 rounded-full bg-success shrink-0';
      text.textContent = 'Claude: conectado';
      text.className = 'text-[12px] text-success';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-amber-500 shrink-0';
      text.textContent = 'Claude: sin API key';
      text.className = 'text-[12px] text-amber-500';
    }

    updateSiteStatus();
  } catch {
    document.getElementById('claude-dot').className = 'w-2 h-2 rounded-full bg-danger shrink-0';
    document.getElementById('claude-text').textContent = 'Server offline';
    document.getElementById('claude-text').className = 'text-[12px] text-danger';
  }
}

function updateSiteStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (state.activeSite) {
    dot.className = 'w-2 h-2 rounded-full bg-success';
    text.textContent = state.activeSite.name;
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-gray-500';
    text.textContent = 'Sin sitio seleccionado';
  }
}

// ==================== SITES ====================
async function loadSites() {
  const res = await fetch('/api/sites');
  const data = await res.json();
  state.sites = data.sites || [];
  renderSiteSelect();
  renderSitesList();
}

function renderSiteSelect() {
  const select = document.getElementById('site-select');
  if (state.sites.length === 0) {
    select.innerHTML = '<option value="">Sin sitios configurados</option>';
    return;
  }
  select.innerHTML = state.sites.map(s =>
    `<option value="${s.id}" ${s.active ? 'selected' : ''}>${s.name} ${s.active ? '●' : ''}</option>`
  ).join('');
}

function renderSitesList() {
  const list = document.getElementById('sites-list');
  if (state.sites.length === 0) {
    list.innerHTML = '<p class="text-text-muted text-sm">No hay sitios configurados.</p>';
    return;
  }
  list.innerHTML = state.sites.map(s => `
    <div class="site-card ${s.active ? 'active-site' : ''}">
      <div>
        <div class="text-sm font-medium">${escapeHtml(s.name)}</div>
        <div class="text-xs text-text-muted mt-0.5">${s.type === 'remote' ? `${escapeHtml(s.ssh_user)}@${escapeHtml(s.ssh_host)}:` : ''}${escapeHtml(s.path)}</div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="testSite('${escapeHtml(s.id)}')" class="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-white/5" title="Test conexion">Test</button>
        ${!s.active ? `<button onclick="activateSite('${escapeHtml(s.id)}')" class="text-xs text-accent hover:text-accent/80 px-2 py-1 rounded hover:bg-white/5">Activar</button>` : '<span class="text-xs text-success">Activo</span>'}
        <button onclick="deleteSite('${escapeHtml(s.id)}')" class="text-xs text-danger/60 hover:text-danger px-2 py-1 rounded hover:bg-white/5">Borrar</button>
      </div>
    </div>
  `).join('');
}

function showAddSite() {
  document.getElementById('add-site-form').classList.remove('hidden');
}

function hideAddSite() {
  document.getElementById('add-site-form').classList.add('hidden');
  document.getElementById('new-site-name').value = '';
  document.getElementById('new-site-path').value = '';
  document.getElementById('new-site-ssh-host').value = '';
  document.getElementById('new-site-ssh-user').value = '';
}

function setupTypeToggle() {
  const typeSelect = document.getElementById('new-site-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      document.getElementById('ssh-fields').classList.toggle('hidden', typeSelect.value !== 'remote');
    });
  }
}

async function addSite() {
  const body = {
    name: document.getElementById('new-site-name').value,
    type: document.getElementById('new-site-type').value,
    path: document.getElementById('new-site-path').value,
    ssh_host: document.getElementById('new-site-ssh-host').value,
    ssh_user: document.getElementById('new-site-ssh-user').value
  };
  if (!body.name || !body.path) return alert('Nombre y path son obligatorios');
  await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  hideAddSite();
  await loadSites();
  await refreshStatus();
}

async function activateSite(id) {
  await fetch(`/api/sites/${id}/activate`, { method: 'POST' });
  await loadSites();
  await refreshStatus();
}

async function deleteSite(id) {
  if (!confirm('Eliminar este sitio?')) return;
  await fetch(`/api/sites/${id}`, { method: 'DELETE' });
  await loadSites();
  await refreshStatus();
}

async function switchSite(id) {
  if (id) await activateSite(id);
}

async function testSite(id) {
  const btn = event.target;
  btn.textContent = '...';
  try {
    const res = await fetch(`/api/sites/${id}/test`, { method: 'POST' });
    const data = await res.json();
    if (data.connected) {
      btn.textContent = `v${data.version}`;
      btn.className = btn.className.replace('text-text-muted', 'text-success');
    } else {
      btn.textContent = 'Error';
      btn.className = btn.className.replace('text-text-muted', 'text-danger');
      const msg = data.error?.includes('no esta instalado') || data.error?.includes('command not found')
        ? `WP-CLI no detectado.\n\nInstala con:\n  brew install wp-cli (macOS)\n  o visita https://wp-cli.org\n\nSi usas MAMP, añade en wp-config.php:\n  define('DB_HOST', 'localhost:/Applications/MAMP/tmp/mysql/mysql.sock');`
        : `Conexion fallida: ${data.error}`;
      alert(msg);
    }
  } catch {
    btn.textContent = 'Error';
  }
  setTimeout(() => { btn.textContent = 'Test'; btn.className = btn.className.replace('text-success', 'text-text-muted').replace('text-danger', 'text-text-muted'); }, 3000);
}

// ==================== CHAT ====================
async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || state.loading) return;

  state.loading = true;
  input.value = '';
  document.getElementById('send-btn').disabled = true;

  // Clear welcome message
  const msgs = document.getElementById('messages');
  if (msgs.querySelector('.text-center')) msgs.innerHTML = '';

  // Add user message
  appendMessage('user', message);

  // Match WP agent skills and show indicator
  const thinkingEl = appendMessage('assistant', '<span class="thinking text-text-muted">Pensando...</span>');
  try {
    const skillMatch = await fetch('/api/wp-skills/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const skillData = await skillMatch.json();
    if (skillData.matched && skillData.matched.length > 0) {
      const skillNames = skillData.matched.map(s => s.name).join(', ');
      thinkingEl.innerHTML = `<span class="thinking text-text-muted">Pensando...</span><span style="display:block;font-size:0.65rem;color:#ff9d36;margin-top:4px;opacity:0.7">🧠 ${skillNames}</span>`;
    }
  } catch { /* non-critical */ }

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    thinkingEl.remove();

    if (data.error) {
      appendMessage('assistant', `<span class="text-danger">${data.error}</span>`);
    } else {
      // Show tool calls
      if (data.toolResults && data.toolResults.length > 0) {
        data.toolResults.forEach(t => appendToolCall(t));
      }
      // Show response
      appendMessage('assistant', formatMarkdown(data.text));
    }
  } catch (err) {
    thinkingEl.remove();
    appendMessage('assistant', `<span class="text-danger">Error: ${err.message}</span>`);
  }

  state.loading = false;
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

function appendMessage(role, html) {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = role === 'user' ? 'msg-user' : 'msg-assistant';
  div.innerHTML = html;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function appendToolCall(tool) {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg-tool';

  const output = typeof tool.output === 'object' ? JSON.stringify(tool.output, null, 2) : String(tool.output || '');
  const truncated = output.length > 500 ? output.slice(0, 500) + '\n... (truncated)' : output;

  div.innerHTML = `
    <div class="tool-name">${tool.name}</div>
    ${tool.command ? `<div class="tool-cmd">$ ${tool.command}</div>` : ''}
    <div class="${tool.success !== false ? 'tool-output' : 'tool-error'}">${escapeHtml(truncated)}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

async function resetChat() {
  await fetch('/api/chat/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  document.getElementById('messages').innerHTML = `
    <div class="text-center text-text-muted text-sm py-12">
      <p class="text-2xl mb-2">&#9889;</p>
      <p class="font-medium">Escribe algo para gestionar tu sitio WordPress</p>
      <p class="text-xs mt-1">Ej: "lista los plugins activos", "crea un post draft", "health check"</p>
    </div>`;
}

// ==================== SETTINGS ====================
async function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return alert('Introduce tu API key');
  const res = await fetch('/api/settings/apikey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: key })
  });
  const data = await res.json();
  if (data.ok) {
    document.getElementById('api-key-input').value = '';
    await refreshStatus();
    alert('API key guardada. Claude conectado.');
  } else {
    alert('Error: ' + (data.error || 'unknown'));
  }
}

// ==================== HISTORY ====================
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    const list = document.getElementById('history-list');
    if (!data.entries || data.entries.length === 0) {
      list.innerHTML = '<p class="text-text-muted text-sm">Sin historial.</p>';
      return;
    }
    list.innerHTML = data.entries.slice().reverse().slice(0, 50).map(e => `
      <div class="bg-surface-alt rounded-lg p-3 border border-white/5">
        <div class="flex justify-between text-xs text-text-muted mb-1">
          <span>${e.site}</span>
          <span>${new Date(e.date).toLocaleString('es')}</span>
        </div>
        <div class="text-sm">${escapeHtml(e.message)}</div>
        ${e.commands.length ? `<div class="text-xs text-text-muted mt-1 font-mono">${e.commands.map(c => '$ ' + c).join('<br>')}</div>` : ''}
      </div>
    `).join('');
  } catch { /* ignore */ }
}

// ==================== SKILLS ====================
let allSkills = [];

async function loadSkills() {
  try {
    const res = await fetch('/api/skills');
    const data = await res.json();
    allSkills = data.skills || [];
    renderSkillsGrid(allSkills);
    renderSkillFilters(allSkills);
    renderSidebarSkills(allSkills);
  } catch { /* ignore */ }
}

function renderSkillsGrid(skills) {
  const grid = document.getElementById('skills-grid');
  if (!skills.length) {
    grid.innerHTML = '<p class="text-text-muted text-sm">No hay skills configurados.</p>';
    return;
  }
  grid.innerHTML = skills.map(s => `
    <div class="skill-card" onclick="runSkill('${escapeHtml(s.id)}')">
      <span class="skill-icon">${escapeHtml(s.icon)}</span>
      <div class="flex-1 min-w-0">
        <div class="skill-name">${escapeHtml(s.name)}</div>
        <div class="skill-desc">${escapeHtml(s.description)}</div>
        <span class="skill-cat">${escapeHtml(s.category)}</span>
      </div>
      <div class="skill-actions" onclick="event.stopPropagation()">
        <button onclick="editSkill('${escapeHtml(s.id)}')" class="text-text-muted hover:text-text-primary p-1 rounded transition-colors" title="Editar">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"/></svg>
        </button>
        <button onclick="deleteSkill('${escapeHtml(s.id)}')" class="text-text-muted hover:text-danger p-1 rounded transition-colors" title="Eliminar">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderSkillFilters(skills) {
  const categories = [...new Set(skills.map(s => s.category))];
  const container = document.getElementById('skill-filters');
  container.innerHTML = `
    <button onclick="filterSkills('all')" class="skill-filter active text-xs px-3 py-1.5 rounded-lg border transition-colors" data-cat="all">Todas</button>
    ${categories.map(c => `<button onclick="filterSkills('${c}')" class="skill-filter text-xs px-3 py-1.5 rounded-lg border transition-colors" data-cat="${c}">${c}</button>`).join('')}
  `;
}

function filterSkills(cat) {
  document.querySelectorAll('.skill-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  const filtered = cat === 'all' ? allSkills : allSkills.filter(s => s.category === cat);
  renderSkillsGrid(filtered);
}

function renderSidebarSkills(skills) {
  const container = document.getElementById('sidebar-workflows');
  const top = skills.slice(0, 4);
  container.innerHTML = `
    <p class="text-[10px] text-text-muted uppercase tracking-widest font-medium px-3 mb-1.5">Workflows</p>
    ${top.map(s => `<button onclick="runSkill('${escapeHtml(s.id)}')" class="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-text-muted hover:text-amber-400 transition-colors flex items-center gap-2"><span>${escapeHtml(s.icon)}</span> ${escapeHtml(s.name)}</button>`).join('')}
    ${skills.length > 4 ? `<button onclick="showView('workflows')" class="w-full text-left px-3 py-1.5 rounded-lg text-[11px] text-amber-500/60 hover:text-amber-400 transition-colors">Ver todos (${skills.length})...</button>` : ''}
  `;
}

function runSkill(id) {
  const skill = allSkills.find(s => s.id === id);
  if (!skill) return;
  showView('chat');
  document.getElementById('chat-input').value = skill.prompt;
  document.getElementById('chat-form').dispatchEvent(new Event('submit'));
}

function showCreateSkill() {
  document.getElementById('skill-form-title').textContent = 'Crear Workflow';
  document.getElementById('skill-edit-id').value = '';
  document.getElementById('skill-name').value = '';
  document.getElementById('skill-icon').value = '';
  document.getElementById('skill-description').value = '';
  document.getElementById('skill-prompt').value = '';
  document.getElementById('skill-category').value = 'custom';
  document.getElementById('skill-form').classList.remove('hidden');
}

function editSkill(id) {
  const skill = allSkills.find(s => s.id === id);
  if (!skill) return;
  document.getElementById('skill-form-title').textContent = 'Editar Workflow';
  document.getElementById('skill-edit-id').value = skill.id;
  document.getElementById('skill-name').value = skill.name;
  document.getElementById('skill-icon').value = skill.icon;
  document.getElementById('skill-description').value = skill.description;
  document.getElementById('skill-prompt').value = skill.prompt;
  document.getElementById('skill-category').value = skill.category;
  document.getElementById('skill-form').classList.remove('hidden');
}

function hideSkillForm() {
  document.getElementById('skill-form').classList.add('hidden');
}

async function saveSkill() {
  const editId = document.getElementById('skill-edit-id').value;
  const body = {
    name: document.getElementById('skill-name').value,
    icon: document.getElementById('skill-icon').value || '⚙️',
    description: document.getElementById('skill-description').value,
    prompt: document.getElementById('skill-prompt').value,
    category: document.getElementById('skill-category').value
  };
  if (!body.name || !body.prompt) return alert('Nombre y prompt son obligatorios');

  if (editId) {
    await fetch(`/api/skills/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } else {
    body.id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await fetch('/api/skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  hideSkillForm();
  await loadSkills();
}

async function deleteSkill(id) {
  if (!confirm('Eliminar este workflow?')) return;
  await fetch(`/api/skills/${id}`, { method: 'DELETE' });
  await loadSkills();
}

// ==================== VIEWS ====================
function showView(view) {
  ['chat', 'settings', 'history', 'workflows'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('hidden', v !== view);
    const btn = document.querySelector(`[data-view="${v}"]`);
    if (btn) btn.classList.toggle('active', v === view);
  });
  if (view === 'history') loadHistory();
  if (view === 'settings') loadSites();
  if (view === 'workflows') loadSkills();
}

// ==================== UTILS ====================
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-[#0f1118] rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Keyboard shortcut: Enter to send (prevent double-submit — form onsubmit handles execution)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && document.activeElement.id === 'chat-input') {
    e.preventDefault();
  }
});

// ==================== QUICK ACTIONS ====================
function quickAction(message) {
  showView('chat');
  document.getElementById('chat-input').value = message;
  document.getElementById('chat-form').dispatchEvent(new Event('submit'));
}

// Init on load
init();
