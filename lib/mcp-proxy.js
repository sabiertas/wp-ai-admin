// MCP Auto-Discovery and Proxy Integration
// Discovers MCP endpoints on WordPress sites and proxies tool calls via HTTP.

const MCP_DISCOVERY_TIMEOUT = 10000;

// Registry of known MCP providers and their discovery paths.
// Add new providers here as they become available.
const MCP_PROVIDERS = [
  {
    id: 'jetengine',
    name: 'JetEngine',
    basePath: '/wp-json/jet-engine/v1/mcp',
    toolsPath: '/wp-json/jet-engine/v1/mcp/tools',
    callPath: '/wp-json/jet-engine/v1/mcp/call',
  },
  {
    id: 'novamira',
    name: 'Novamira',
    basePath: '/wp-json/mcp/mcp-adapter-default-server',
    toolsPath: '/wp-json/mcp/mcp-adapter-default-server/tools',
    callPath: '/wp-json/mcp/mcp-adapter-default-server/call',
  },
];

/**
 * Probe a single MCP provider on a site.
 * Returns { available: true, tools: [...] } or { available: false }.
 */
async function probeProvider(siteUrl, provider, authHeader) {
  try {
    const url = `${siteUrl.replace(/\/+$/, '')}${provider.toolsPath}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MCP_DISCOVERY_TIMEOUT);

    const headers = { 'Accept': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { available: false };

    const data = await res.json();

    // Normalize: the endpoint may return { tools: [...] } or just [...]
    const tools = Array.isArray(data) ? data : (data.tools || []);
    if (!Array.isArray(tools) || tools.length === 0) return { available: false };

    return { available: true, tools, toolCount: tools.length };
  } catch {
    return { available: false };
  }
}

/**
 * Build a Basic Auth header from site credentials.
 * Expects site.wp_user and site.wp_app_password (WordPress Application Password).
 */
function buildAuthHeader(site) {
  if (!site.wp_user || !site.wp_app_password) return null;
  const credentials = Buffer.from(`${site.wp_user}:${site.wp_app_password}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Discover all available MCP providers on a site.
 * Returns an object: { jetengine: { available, tools, toolCount }, ... }
 */
export async function discoverMcp(site) {
  if (!site.url) return {};

  const authHeader = buildAuthHeader(site);
  const results = {};

  const probes = MCP_PROVIDERS.map(async (provider) => {
    const result = await probeProvider(site.url, provider, authHeader);
    results[provider.id] = {
      ...result,
      name: provider.name,
    };
  });

  await Promise.all(probes);
  return results;
}

/**
 * Convert MCP tool definitions to Claude API tool format.
 * MCP tools use a different schema format that needs normalization.
 * Prefixes tool names with `mcp_{providerId}_` to avoid collisions.
 */
export function mcpToolsToClaude(providerId, mcpTools) {
  return mcpTools.map(tool => {
    const name = `mcp_${providerId}_${tool.name}`;
    // Ensure name fits Claude's tool name constraints (max 64 chars, alphanumeric + underscores)
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);

    return {
      name: safeName,
      description: `[MCP/${providerId}] ${tool.description || tool.name}`,
      input_schema: tool.inputSchema || tool.input_schema || {
        type: 'object',
        properties: {},
        required: []
      },
      // Internal metadata for routing
      _mcp: {
        providerId,
        originalName: tool.name,
      }
    };
  });
}

/**
 * Execute an MCP tool call by proxying to the site's MCP endpoint.
 * Returns { success, output, command }.
 */
export async function executeMcpTool(site, providerId, toolName, input) {
  const provider = MCP_PROVIDERS.find(p => p.id === providerId);
  if (!provider) {
    return { success: false, output: `MCP provider "${providerId}" not found.`, command: null };
  }

  const authHeader = buildAuthHeader(site);
  if (!authHeader) {
    return {
      success: false,
      output: 'Site credentials (wp_user + wp_app_password) required for MCP calls.',
      command: null
    };
  }

  const url = `${site.url.replace(/\/+$/, '')}${provider.callPath}`;
  const body = JSON.stringify({ tool: toolName, input: input || {} });
  const command = `MCP ${providerId}/${toolName}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        output: data.message || data.error || `HTTP ${res.status}`,
        command,
      };
    }

    // Normalize output: MCP may return { result: ... } or { content: [...] } or raw data
    let output = data;
    if (data.result !== undefined) output = data.result;
    else if (data.content) output = data.content;

    return {
      success: true,
      output: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
      command,
    };
  } catch (err) {
    return {
      success: false,
      output: err.name === 'AbortError' ? 'MCP call timed out (30s).' : err.message,
      command,
    };
  }
}

/**
 * Parse an MCP-prefixed tool name back to its provider and original name.
 * e.g. "mcp_jetengine_add_cpt" -> { providerId: "jetengine", toolName: "add_cpt" }
 * Returns null if the name doesn't match the MCP pattern.
 */
export function parseMcpToolName(name) {
  const match = name.match(/^mcp_([a-zA-Z0-9]+)_(.+)$/);
  if (!match) return null;
  return { providerId: match[1], toolName: match[2] };
}

/**
 * Get a summary of MCP capabilities for a site.
 * Returns an array like [{ id: 'jetengine', name: 'JetEngine', toolCount: 11 }, ...]
 */
export function getMcpSummary(site) {
  if (!site.mcp) return [];
  return Object.entries(site.mcp)
    .filter(([, info]) => info.available)
    .map(([id, info]) => ({
      id,
      name: info.name,
      toolCount: info.toolCount || 0,
    }));
}
