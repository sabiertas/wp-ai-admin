// Claude API client with tool use for WP-CLI
import Anthropic from '@anthropic-ai/sdk';
import { getToolDefinitions, findTool } from './tools.js';
import { executeWpCli } from './wp-cli.js';

let client = null;

export function initClient(apiKey) {
  client = new Anthropic({ apiKey });
}

export function isConnected() {
  return client !== null;
}

const SYSTEM_PROMPT = `You are a WordPress administration assistant. You help manage WordPress sites using WP-CLI commands.

When the user asks about their WordPress site, use the available tools to get information or make changes. Always explain what you're doing and show the results clearly.

Important rules:
- For destructive operations (activate/deactivate plugins, delete content), confirm with the user first by explaining what you'll do
- Always format output in a readable way (tables, lists)
- If a command fails, explain why and suggest alternatives
- You can chain multiple tool calls to build a complete picture (e.g., health check = version + plugins + theme)

Respond in the same language the user writes in (Spanish or English).`;

export async function chat(messages, site) {
  if (!client) throw new Error('Claude API not connected. Set your API key in Settings.');

  const tools = getToolDefinitions();
  const toolResults = [];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT + `\n\nActive WordPress site: "${site.name}" at ${site.path} (${site.type})`,
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
      system: SYSTEM_PROMPT + `\n\nActive WordPress site: "${site.name}" at ${site.path} (${site.type})`,
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
