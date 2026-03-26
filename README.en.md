# WP AI Admin

🇪🇸 [Leer en español](README.md)

> Manage your WordPress sites with natural language — powered by Claude AI + WP-CLI.

![WP AI Admin](https://img.shields.io/badge/WordPress-AI%20Admin-ff9d36?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square) ![Node](https://img.shields.io/badge/node-18%2B-green?style=flat-square)

WP AI Admin is a local web application that lets you manage any WordPress site through a chat interface. Ask questions in plain language, and Claude AI translates your intent into WP-CLI commands — executed in real-time on your site.

## Features

- **Natural language WordPress management** — "list active plugins", "create a draft post about SEO", "do a health check"
- **29 pre-built WP-CLI tools** + a generic `wp_cli_run` that executes ANY WP-CLI command
- **MCP Auto-Discovery** — automatically detects and connects MCP servers on your WordPress sites (JetEngine, and more coming)
- **Smart context loading** — auto-fetches site configuration (CPTs, taxonomies, meta boxes, queries) so the AI knows what exists before acting
- **14 WordPress Agent Skills** from the [official WordPress repo](https://github.com/WordPress/agent-skills) — auto-loaded by context
- **21 ready-to-use Workflows** — multi-step recipes: security audit, performance review, DB cleanup, domain migration, WindPress/Tailwind debug, and more
- **Multi-site management** — add local (MAMP) or remote (SSH) WordPress sites
- **Command history** — full log of every WP-CLI command executed
- **Installable as PWA** — use it as a desktop app
- **Custom workflows** — create, edit, and share your own automation recipes

## Quick Start

```bash
git clone https://github.com/sabiertas/wp-ai-admin.git
cd wp-ai-admin
bash setup.sh
npm start
```

Then open **http://localhost:3848**

> The `wp-ai-admin/` directory is created wherever you run `git clone`. To start it again later, navigate to that directory and run `npm start`.

### Update

```bash
cd wp-ai-admin
git pull
npm start
```

Your configuration (API key and sites) is preserved when updating.

### What `setup.sh` does

1. Checks Node.js ≥ 18
2. **Detects your environment** (MAMP, Local WP, or remote SSH) and guides WP-CLI installation
3. Installs dependencies (`npm install`)
4. Downloads [WordPress Agent Skills](https://github.com/WordPress/agent-skills)
5. Creates config directory
6. Optionally sets your Anthropic API key

> If WP-CLI is not found, the installer walks you through it step by step for your specific setup.

## Requirements

- **Node.js 18+** ([download](https://nodejs.org))
- **Anthropic API key** ([get one here](https://console.anthropic.com/))
- A WordPress site (local or remote via SSH)
- **WP-CLI** — `setup.sh` will detect and guide installation if missing

## Architecture

```
wp-ai-admin/
├── server.js              # Express server + API routes
├── lib/
│   ├── claude.js          # Claude API client with tool_use
│   ├── tools.js           # 29 WP-CLI tool definitions
│   ├── wp-cli.js          # Command executor (local + SSH)
│   ├── wp-skills.js       # Dynamic skill loader from WordPress/agent-skills
│   └── mcp-proxy.js       # MCP auto-discovery, JSON-RPC proxy & context
├── public/
│   ├── index.html         # UI (Tailwind v4 + amber palette)
│   ├── app.js             # Frontend logic
│   └── manifest.json      # PWA manifest
├── config/
│   ├── skills.json        # Workflow recipes (editable from UI)
│   └── sites.json         # Site credentials (gitignored)
├── vendor/
│   └── agent-skills/      # WordPress official agent skills (auto-cloned)
└── setup.sh               # One-command installer
```

### How it works

1. User types a message in the chat
2. The system matches relevant WordPress Agent Skills by analyzing the message
3. If the site has MCP providers (e.g. JetEngine), site context is auto-loaded (CPTs, taxonomies, fields, queries)
4. Skills and MCP context are injected into Claude's system prompt
5. Claude decides which tools to use: WP-CLI, MCP tools, or both
6. Commands execute on the active WordPress site
7. Results are displayed in the chat with the executed commands visible

### MCP Integration

WP AI Admin automatically detects MCP servers installed on your WordPress sites. Currently supported:

| Provider | Protocol | Tools | Auto-context |
|----------|----------|-------|-------------|
| **JetEngine** | JSON-RPC via REST | CPTs, taxonomies, meta boxes, CCTs, glossaries, queries, listings | Yes — loads full site config |

When you connect a site with JetEngine MCP enabled:
- Available tools are discovered automatically
- Site context is loaded (existing CPTs, their fields, etc.)
- Claude can create, query and modify JetEngine structures via MCP
- Cache auto-invalidates when new elements are created

### WordPress Agent Skills (auto-loaded)

The app includes all 14 official skills from [WordPress/agent-skills](https://github.com/WordPress/agent-skills):

| Skill | Loaded when... |
|---|---|
| `wp-wpcli-and-ops` | Any WP-CLI operation (always as base) |
| `wp-performance` | Performance, speed, optimization, CSS/Tailwind/WindPress |
| `wp-plugin-development` | Plugin scaffolding, hooks, architecture, WindPress/Tailwind config |
| `wp-block-development` | Gutenberg blocks, block.json |
| `wp-block-themes` | theme.json, FSE, templates |
| `wp-rest-api` | REST endpoints, API routes |
| `wp-interactivity-api` | Frontend directives, stores |
| `wp-phpstan` | Static analysis |
| `wp-playground` | Disposable WP instances |
| ...and more | |

Skills are loaded **automatically** based on what you ask — no configuration needed.

## Screenshots

### Chat with WP-CLI
Ask anything — Claude executes the right WP-CLI commands and explains the results.

### Workflows
21 pre-built multi-step recipes including WindPress/Tailwind debugging (v3/v4 detection). Create your own from the UI.

### Settings
Manage API key and WordPress sites (local MAMP or remote SSH).

## Adding a WordPress Site

### Local (MAMP / Local WP)

1. Go to **Settings** → **+ Add site**
2. Name: `My Local Site`
3. Type: `Local`
4. Path: `/path/to/your/wordpress/` (the directory with `wp-config.php`)

### Remote (SSH)

1. Type: `Remote`
2. SSH Host: `your-server.com`
3. SSH User: `root` (or your SSH user)
4. Path: `/var/www/html/` (remote WordPress path)

> Make sure you have SSH key auth configured for remote sites.

## Tech Stack

- **Backend**: Node.js + Express
- **AI**: Claude API (claude-sonnet-4-20250514) with tool_use
- **Frontend**: Vanilla JS + Tailwind CSS v4 (browser CDN)
- **Design**: Flowtitude Design System amber palette
- **WordPress**: WP-CLI (any command)

## License

MIT

## Credits

- [Anthropic Claude API](https://docs.anthropic.com/) — AI backbone
- [WordPress/agent-skills](https://github.com/WordPress/agent-skills) — Expert WordPress knowledge
- [Flowtitude Design System](https://flowtitude.com) — Visual identity
- [WP-CLI](https://wp-cli.org/) — WordPress command line
