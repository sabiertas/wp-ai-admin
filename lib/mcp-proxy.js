// MCP Auto-Discovery and Proxy Integration
// Discovers MCP endpoints on WordPress sites and proxies tool calls via HTTP.

import https from 'https';

// Allow self-signed certs for local MAMP/dev sites
const localAgent = new https.Agent({ rejectUnauthorized: false });

const MCP_DISCOVERY_TIMEOUT = 10000;

// Registry of known MCP providers and their discovery paths.
// Add new providers here as they become available.
const MCP_PROVIDERS = [
  {
    id: 'jetengine',
    name: 'JetEngine',
    basePath: '/wp-json/jet-engine/v1/mcp',
    toolsPath: '/wp-json/jet-engine/v1/mcp-tools',
    callPath: '/wp-json/jet-engine/v1/mcp-tools/run',
  },
  // Novamira uses stdio MCP proxy (npx @automattic/mcp-wordpress-remote), not REST endpoints.
  // It works with Claude Code directly but NOT with HTTP auto-discovery.
  // Future: if Novamira adds REST endpoints, re-enable here.
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
 * Uses JSON-RPC protocol via the /mcp endpoint (no nonce required, only manage_options capability).
 * Falls back to /run/ endpoint if MCP endpoint is not available.
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

  const command = `MCP ${providerId}/${toolName}`;

  // Use JSON-RPC via /mcp endpoint (no nonce needed, only current_user_can('manage_options'))
  if (provider.id === 'jetengine') {
    const url = `${site.url.replace(/\/+$/, '')}${provider.basePath}`;
    const rpcBody = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: input || {}
      }
    });

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
        body: rpcBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          output: data.message || data.error?.message || `HTTP ${res.status}`,
          command,
        };
      }

      // JSON-RPC response: { jsonrpc, id, result: { content: [{ type, text }], isError } }
      if (data.error) {
        return {
          success: false,
          output: data.error.message || JSON.stringify(data.error),
          command,
        };
      }

      const result = data.result;
      if (!result) {
        return { success: false, output: 'Empty MCP response', command };
      }

      // Extract text content from MCP ToolResult format
      if (result.isError) {
        const errorText = result.content?.map(c => c.text).join('\n') || 'Tool error';
        return { success: false, output: errorText, command };
      }

      const outputText = result.content?.map(c => c.text).join('\n') || JSON.stringify(result, null, 2);
      return { success: true, output: outputText, command };

    } catch (err) {
      return {
        success: false,
        output: err.name === 'AbortError' ? 'MCP call timed out (30s).' : err.message,
        command,
      };
    }
  }

  // Generic fallback for non-JetEngine providers
  const baseUrl = `${site.url.replace(/\/+$/, '')}${provider.callPath}`;
  const body = JSON.stringify({ tool: toolName, input: input || {} });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(baseUrl, {
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

// ==================== MCP CONTEXT AUTO-FETCH ====================

// In-memory cache: siteId -> { data, timestamp }
const contextCache = {};
const CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch JetEngine configuration context from a site.
 * Calls the resource-get-configuration MCP tool to get CPTs, taxonomies, meta boxes, etc.
 * Returns the configuration object or null if unavailable.
 */
export async function fetchJetEngineContext(site) {
  if (!site.mcp?.jetengine?.available) return null;

  // Check cache
  const cached = contextCache[site.id];
  if (cached && (Date.now() - cached.timestamp) < CONTEXT_TTL) {
    return cached.data;
  }

  const authHeader = buildAuthHeader(site);
  if (!authHeader) return null;

  const provider = MCP_PROVIDERS.find(p => p.id === 'jetengine');
  if (!provider) return null;

  try {
    // Fetch configuration
    const configResult = await executeMcpTool(site, 'jetengine', 'resource-get-configuration', {
      parts: {
        post_types: true,
        taxonomies: true,
        meta_boxes: true,
        queries: true,
        relations: true,
        custom_content_types: true,
        glossaries: true,
      }
    });

    // Fetch website config (registered post types, active plugins)
    const siteConfigResult = await executeMcpTool(site, 'jetengine', 'resource-get-website-config', {
      parts: {
        post_types: true,
        taxonomies: true,
        active_plugins: true,
      }
    });

    const context = {
      jetengine: configResult.success ? safeJsonParse(configResult.output) : null,
      website: siteConfigResult.success ? safeJsonParse(siteConfigResult.output) : null,
    };

    // Cache it
    contextCache[site.id] = { data: context, timestamp: Date.now() };
    return context;
  } catch {
    return null;
  }
}

/**
 * Build a context summary string for the system prompt.
 * Summarizes the JetEngine configuration in a compact format.
 */
export function buildMcpContextPrompt(context) {
  if (!context) return '';

  const parts = [];
  parts.push('\n\n## JetEngine Site Context (auto-fetched)\n');
  parts.push('Use this information to understand the site structure before creating or modifying content types.\n');

  // JetEngine context may come as parsed object or JSON string
  const je = typeof context.jetengine === 'string' ? safeJsonParse(context.jetengine) : context.jetengine;

  if (je) {
    if (je.post_types?.length > 0) {
      parts.push('\n### Custom Post Types');
      for (const cpt of je.post_types) {
        const name = cpt.labels?.[0] || cpt.general_settings?.name || cpt.name || cpt.slug || 'Unknown';
        const slug = cpt.slug || cpt.general_settings?.slug || '';
        const fields = cpt.meta_fields?.length || 0;
        parts.push(`- **${name}** (slug: \`${slug}\`) — ${fields} meta fields`);
        if (cpt.meta_fields?.length > 0) {
          const fieldSummaries = cpt.meta_fields.map(f => {
            const fname = f.name || f.field_name || f.title;
            const ftype = f.type || f.field_type || '';
            return `${fname} (${ftype})`;
          }).filter(Boolean);
          if (fieldSummaries.length) parts.push(`  Fields: ${fieldSummaries.join(', ')}`);
        }
      }
    }

    if (je.taxonomies?.length > 0) {
      parts.push('\n### Taxonomies');
      for (const tax of je.taxonomies) {
        const name = tax.labels?.[0] || tax.general_settings?.name || tax.name || tax.slug || 'Unknown';
        const slug = tax.slug || tax.general_settings?.slug || '';
        const postTypes = tax.object_type || tax.general_settings?.object_type || [];
        parts.push(`- **${name}** (slug: \`${slug}\`) → assigned to: ${Array.isArray(postTypes) ? postTypes.join(', ') : postTypes}`);
      }
    }

    if (je.meta_boxes?.length > 0) {
      parts.push('\n### Meta Boxes');
      for (const mb of je.meta_boxes) {
        const name = mb.general_settings?.name || mb.name || 'Unknown';
        const target = mb.general_settings?.object_type || mb.object_type || 'post';
        const fields = mb.meta_fields?.length || 0;
        parts.push(`- **${name}** (${target}) — ${fields} fields`);
      }
    }

    if (je.relations?.length > 0) {
      parts.push('\n### Relations');
      for (const rel of je.relations) {
        parts.push(`- ${rel.name || 'Unnamed'}: ${rel.parent_object || '?'} ↔ ${rel.child_object || '?'} (${rel.type || '?'})`);
      }
    }

    if (je.queries?.length > 0) {
      parts.push('\n### Queries');
      for (const q of je.queries) {
        parts.push(`- **${q.name || q.title || 'Unnamed'}** (type: ${q.type || '?'})`);
      }
    }

    if (je.custom_content_types?.length > 0) {
      parts.push('\n### Custom Content Types');
      for (const cct of je.custom_content_types) {
        parts.push(`- **${cct.name || cct.slug || 'Unnamed'}** (slug: \`${cct.slug || '?'}\`)`);
      }
    }

    if (je.glossaries?.length > 0) {
      parts.push('\n### Glossaries');
      for (const g of je.glossaries) {
        const itemCount = g.fields?.length || g.options?.length || 0;
        parts.push(`- **${g.name || 'Unnamed'}** — ${itemCount} items`);
      }
    }
  }

  if (context.website) {
    const web = context.website;
    if (web.active_plugins?.length > 0) {
      parts.push('\n### Active Plugins');
      parts.push(web.active_plugins.map(p => `- ${p}`).join('\n'));
    }
  }

  parts.push('\n\nWhen the user asks to create a CPT, taxonomy, or content structure, reference this context to avoid duplicates and suggest relationships with existing types.');

  return parts.join('\n');
}

/**
 * Invalidate context cache for a site (call after creating/modifying JetEngine items).
 */
export function invalidateContextCache(siteId) {
  delete contextCache[siteId];
}

function safeJsonParse(str) {
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return str; }
}
