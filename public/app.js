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
      dot.className = 'w-2 h-2 rounded-full bg-success';
      text.textContent = 'Claude: conectado';
      text.className = 'text-success text-xs';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-warning';
      text.textContent = 'Claude: sin API key';
      text.className = 'text-warning text-xs';
    }

    updateSiteStatus();
  } catch {
    document.getElementById('claude-dot').className = 'w-2 h-2 rounded-full bg-danger';
    document.getElementById('claude-text').textContent = 'Server offline';
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
        <div class="text-sm font-medium">${s.name}</div>
        <div class="text-xs text-text-muted mt-0.5">${s.type === 'remote' ? `${s.ssh_user}@${s.ssh_host}:` : ''}${s.path}</div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="testSite('${s.id}')" class="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-white/5" title="Test conexion">Test</button>
        ${!s.active ? `<button onclick="activateSite('${s.id}')" class="text-xs text-accent hover:text-accent/80 px-2 py-1 rounded hover:bg-white/5">Activar</button>` : '<span class="text-xs text-success">Activo</span>'}
        <button onclick="deleteSite('${s.id}')" class="text-xs text-danger/60 hover:text-danger px-2 py-1 rounded hover:bg-white/5">Borrar</button>
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
      alert(`Conexion fallida: ${data.error}`);
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

  // Add thinking indicator
  const thinkingEl = appendMessage('assistant', '<span class="thinking text-text-muted">Pensando...</span>');

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

// ==================== VIEWS ====================
function showView(view) {
  ['chat', 'settings', 'history'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== view);
    document.querySelector(`[data-view="${v}"]`).classList.toggle('active', v === view);
  });
  if (view === 'history') loadHistory();
  if (view === 'settings') loadSites();
}

// ==================== UTILS ====================
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatMarkdown(text) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-[#0f1118] rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Keyboard shortcut: Enter to send
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && document.activeElement.id === 'chat-input') {
    sendMessage(e);
  }
});

// Init on load
init();
