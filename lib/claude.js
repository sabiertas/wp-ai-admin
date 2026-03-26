// Claude API client with tool use for WP-CLI + MCP proxy
import Anthropic from '@anthropic-ai/sdk';
import { getToolDefinitions, findTool } from './tools.js';
import { executeWpCli } from './wp-cli.js';
import { matchSkills, buildSkillContext } from './wp-skills.js';
import { mcpToolsToClaude, parseMcpToolName, executeMcpTool, getMcpSummary, fetchJetEngineContext, buildMcpContextPrompt, invalidateContextCache } from './mcp-proxy.js';

let client = null;

export function initClient(apiKey) {
  client = new Anthropic({ apiKey });
}

export function isConnected() {
  return client !== null;
}

const SYSTEM_PROMPT = `You are a WordPress administration assistant with FULL access to WP-CLI. You can execute ANY WP-CLI command on the user's site.

You have two approaches:
1. **Specific tools** — pre-built tools for common tasks (plugin list, post create, etc.). Use these when they fit.
2. **wp_cli_run** — a generic tool that executes ANY WP-CLI command. Use this for anything the specific tools don't cover. You have the ENTIRE WP-CLI command set available: db, config, scaffold, media regenerate, role, cap, menu, widget, sidebar, comment, term, taxonomy, language, wc (WooCommerce), and more.

Prefer wp_cli_run for complex or uncommon operations. Add --format=json when listing data for clean output.

Important rules:
- For destructive operations (delete, update, activate/deactivate), explain what you'll do BEFORE executing
- For search-replace, ALWAYS run --dry-run first and show results before the real run
- Format output clearly: tables, lists, summaries
- If a command fails, explain why and suggest alternatives
- Chain multiple tool calls to build a complete picture (e.g., health check = version + plugins + theme + db size)
- You can use wp eval to run arbitrary PHP in the WordPress context for anything WP-CLI doesn't have a direct command for

Respond in the same language the user writes in (Spanish or English).`;

/**
 * Build the full system prompt with dynamic skill context.
 * Analyzes the user's latest message to determine which WordPress expert skills to inject.
 * @param {Object} mcpContext - Pre-fetched MCP context (JetEngine config, etc.)
 */
function buildSystemPrompt(messages, site, mcpContext) {
  let prompt = SYSTEM_PROMPT;
  prompt += `\n\nActive WordPress site: "${site.name}" at ${site.path} (${site.type})`;

  // Add MCP provider info if available
  const mcpSummary = getMcpSummary(site);
  if (mcpSummary.length > 0) {
    const mcpLines = mcpSummary.map(p => `- ${p.name}: ${p.toolCount} tools (prefixed mcp_${p.id}_*)`);
    prompt += `\n\nMCP integrations available on this site:\n${mcpLines.join('\n')}`;
    prompt += `\nUse these MCP tools when the user's request matches their capabilities. They call the site's REST API directly.`;
    prompt += `\nIMPORTANT: When using JetEngine MCP tools to CREATE content types (CPT, taxonomy, meta box, CCT), after a successful creation, tell the user you'll refresh context on the next message.`;
  }

  // Inject MCP context (JetEngine site structure)
  if (mcpContext) {
    prompt += buildMcpContextPrompt(mcpContext);
  }

  // Get the latest user message for skill matching
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userText = typeof lastUserMsg?.content === 'string'
    ? lastUserMsg.content
    : Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.filter(b => b.type === 'text').map(b => b.text).join(' ')
      : '';

  if (userText) {
    const matched = matchSkills(userText);
    if (matched.length > 0) {
      const skillContext = buildSkillContext(matched);
      if (skillContext) {
        prompt += skillContext;
      }
    }
  }

  return prompt;
}

export async function chat(messages, site) {
  if (!client) throw new Error('Claude API not connected. Set your API key in Settings.');

  // Build tool list: WP-CLI tools + MCP tools from discovered providers
  const tools = getToolDefinitions();
  const mcpSummary = getMcpSummary(site);
  const mcpToolMap = {}; // name -> { providerId, originalName }

  for (const provider of mcpSummary) {
    const mcpInfo = site.mcp[provider.id];
    if (mcpInfo?.available && mcpInfo.tools) {
      const claudeTools = mcpToolsToClaude(provider.id, mcpInfo.tools);
      for (const ct of claudeTools) {
        mcpToolMap[ct.name] = ct._mcp;
        tools.push({ name: ct.name, description: ct.description, input_schema: ct.input_schema });
      }
    }
  }

  // Auto-fetch MCP context (JetEngine config, etc.) — non-blocking
  let mcpContext = null;
  try {
    mcpContext = await fetchJetEngineContext(site);
  } catch { /* context fetch is non-blocking */ }

  const toolResults = [];
  const systemPrompt = buildSystemPrompt(messages, site, mcpContext);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    tools,
    messages
  });

  // Process the response — handle tool_use blocks
  let assistantContent = response.content;
  let currentMessages = [...messages, { role: 'assistant', content: assistantContent }];

  // Loop while Claude wants to use tools
  while (response.stop_reason === 'tool_use' || assistantContent.some(b => b.type === 'tool_use')) {
    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    const toolResultBlocks = [];

    for (const toolUse of toolUseBlocks) {
      // Check if this is an MCP tool call
      const mcpMeta = mcpToolMap[toolUse.name];
      if (mcpMeta) {
        const result = await executeMcpTool(site, mcpMeta.providerId, mcpMeta.originalName, toolUse.input);
        const resultStr = typeof result.output === 'object'
          ? JSON.stringify(result.output, null, 2)
          : String(result.output);

        // Invalidate context cache if a creation/modification tool was used
        if (result.success && /^(tool-add|tool-manage)/.test(mcpMeta.originalName)) {
          invalidateContextCache(site.id);
        }

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultStr
        });

        toolResults.push({
          name: toolUse.name,
          input: toolUse.input,
          command: result.command,
          success: result.success,
          output: result.output
        });
        continue;
      }

      // Standard WP-CLI tool
      const tool = findTool(toolUse.name);
      if (!tool) {
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Tool "${toolUse.name}" not found.`
        });
        toolResults.push({ name: toolUse.name, input: toolUse.input, error: 'Tool not found' });
        continue;
      }

      const command = tool.buildCommand(toolUse.input);
      const result = await executeWpCli(command, site);

      const resultStr = typeof result.output === 'object'
        ? JSON.stringify(result.output, null, 2)
        : String(result.output);

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: resultStr
      });

      toolResults.push({
        name: toolUse.name,
        input: toolUse.input,
        command: result.command,
        success: result.success,
        output: result.output
      });
    }

    // Continue the conversation with tool results
    currentMessages.push({ role: 'user', content: toolResultBlocks });

    const nextResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: currentMessages
    });

    assistantContent = nextResponse.content;
    currentMessages.push({ role: 'assistant', content: assistantContent });

    // If no more tool use, break
    if (nextResponse.stop_reason !== 'tool_use' && !assistantContent.some(b => b.type === 'tool_use')) {
      break;
    }
  }

  // Extract text from the final response
  const textBlocks = assistantContent.filter(b => b.type === 'text');
  const text = textBlocks.map(b => b.text).join('\n');

  return {
    text,
    toolResults,
    messages: currentMessages
  };
}
