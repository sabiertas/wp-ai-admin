// WordPress Agent Skills — Dynamic loader
// Reads official skills from vendor/agent-skills/ and injects relevant ones into Claude's system prompt.
// Skills are selected automatically based on user message context — no manual configuration needed.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'vendor', 'agent-skills', 'skills');

// Cache: loaded once at startup, reused for all requests
let skillIndex = null;

// Keyword map: maps topic keywords to skill names for fast matching.
// Built from each skill's "description" and "When to use" section.
const KEYWORD_ROUTES = {
  'wp-wpcli-and-ops': [
    'wp-cli', 'wpcli', 'search-replace', 'db export', 'db import', 'database',
    'plugin list', 'plugin install', 'plugin update', 'plugin activate', 'plugin deactivate',
    'theme install', 'theme update', 'theme activate',
    'user create', 'user list', 'user delete',
    'cron', 'cache flush', 'rewrite flush', 'transient',
    'multisite', 'maintenance', 'backup', 'migrate', 'migration',
    'search replace', 'export', 'import', 'option', 'config',
    'update', 'actualizar', 'instalar', 'desactivar', 'activar',
    'plugins', 'temas', 'usuarios', 'base de datos',
    'limpieza', 'limpiar', 'optimizar', 'cron', 'health check',
    'version', 'core', 'seguridad', 'security', 'audit',
    'backup', 'respaldo', 'restaurar'
  ],
  'wp-performance': [
    'performance', 'rendimiento', 'slow', 'lento', 'speed', 'velocidad',
    'profiling', 'query monitor', 'autoload', 'object cache', 'redis', 'memcached',
    'optimize', 'optimizar', 'db size', 'tabla', 'tables',
    'memory', 'memoria', 'cpu', 'server timing', 'transients',
    'css', 'tailwind', 'windpress', 'purge', 'compilar', 'compile',
    'assets', 'enqueue', 'stylesheet'
  ],
  'wp-plugin-development': [
    'plugin development', 'crear plugin', 'scaffold plugin', 'develop plugin',
    'windpress', 'tailwind', 'tailwindcss', 'postcss', '@theme',
    'css config', 'css configuration', 'configuracion css',
    'hooks', 'actions', 'filters', 'settings api', 'admin page',
    'activation hook', 'deactivation', 'uninstall', 'nonce', 'sanitize',
    'capability', 'plugin architecture', 'desarrollar plugin'
  ],
  'wp-block-development': [
    'block', 'bloque', 'gutenberg', 'block.json', 'block editor',
    'innerblocks', 'useblockprops', 'render.php', 'block attributes',
    'deprecation', 'block supports', 'viewscript', 'create-block',
    'register_block_type', 'dynamic block', 'static block'
  ],
  'wp-block-themes': [
    'theme.json', 'block theme', 'tema de bloques', 'full site editing',
    'site editor', 'template parts', 'patterns', 'style variations',
    'global styles', 'templates', 'plantillas'
  ],
  'wp-rest-api': [
    'rest api', 'api rest', 'endpoint', 'register_rest_route',
    'wp_rest', 'json api', 'rest controller', 'permission_callback',
    'rest field', 'rest schema', 'api endpoint', 'wp-json'
  ],
  'wp-interactivity-api': [
    'interactivity', 'data-wp-', 'interactivity api', 'directive',
    'wp_interactivity', 'interactive block', 'store', 'frontend interactivity'
  ],
  'wp-abilities-api': [
    'abilities api', 'wp_register_ability', 'ability', 'capabilities api'
  ],
  'wp-phpstan': [
    'phpstan', 'static analysis', 'type checking', 'php analysis',
    'baseline', 'phpstan.neon'
  ],
  'wp-playground': [
    'playground', 'wp-playground', 'disposable', 'blueprint',
    'instant wordpress', 'sandbox', 'wp-now'
  ],
  'wpds': [
    'design system', 'wpds', 'wordpress design system', 'wp components',
    'wordpress ui components'
  ]
};

/**
 * Load and index all skills from vendor/agent-skills/skills/
 */
function loadSkillIndex() {
  if (skillIndex) return skillIndex;

  skillIndex = {};

  if (!existsSync(SKILLS_DIR)) {
    console.log('  [wp-skills] vendor/agent-skills not found. Run: git clone https://github.com/WordPress/agent-skills vendor/agent-skills');
    return skillIndex;
  }

  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillPath = join(SKILLS_DIR, dir, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf-8');

    // Parse frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = {};
    if (fmMatch) {
      fmMatch[1].split('\n').forEach(line => {
        const [key, ...val] = line.split(':');
        if (key && val.length) frontmatter[key.trim()] = val.join(':').trim().replace(/^"|"$/g, '');
      });
    }

    // Get body (after frontmatter)
    const body = content.replace(/^---\n[\s\S]*?\n---\n*/, '');

    // Load references if they exist
    const refsDir = join(SKILLS_DIR, dir, 'references');
    const references = {};
    if (existsSync(refsDir)) {
      const refFiles = readdirSync(refsDir).filter(f => f.endsWith('.md'));
      for (const rf of refFiles) {
        references[rf] = readFileSync(join(refsDir, rf), 'utf-8');
      }
    }

    skillIndex[dir] = {
      name: frontmatter.name || dir,
      description: frontmatter.description || '',
      content: body,
      references,
      refCount: Object.keys(references).length,
      keywords: KEYWORD_ROUTES[dir] || []
    };
  }

  console.log(`  [wp-skills] Loaded ${Object.keys(skillIndex).length} WordPress agent skills`);
  return skillIndex;
}

/**
 * Match user message to relevant skills.
 * Returns array of skill names sorted by relevance (max 3).
 */
export function matchSkills(userMessage) {
  const index = loadSkillIndex();
  const msg = userMessage.toLowerCase();
  const scores = {};

  // Always include wp-wpcli-and-ops as base (we're a WP-CLI app)
  scores['wp-wpcli-and-ops'] = 1;

  for (const [skillName, keywords] of Object.entries(KEYWORD_ROUTES)) {
    if (!index[skillName]) continue;

    let score = 0;
    for (const kw of keywords) {
      if (msg.includes(kw.toLowerCase())) {
        score += kw.includes(' ') ? 3 : 1; // multi-word matches score higher
      }
    }

    if (score > 0) {
      scores[skillName] = (scores[skillName] || 0) + score;
    }
  }

  // Sort by score, take top 3
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

/**
 * Build the system prompt injection for matched skills.
 * Returns a string to append to the system prompt.
 * Only loads SKILL.md (not full references) to save tokens.
 * If a skill is highly relevant (top match), includes key references too.
 */
export function buildSkillContext(matchedSkillNames) {
  const index = loadSkillIndex();
  if (matchedSkillNames.length === 0) return '';

  const parts = ['\n\n---\n## WordPress Expert Knowledge (auto-loaded)\n'];

  for (let i = 0; i < matchedSkillNames.length; i++) {
    const name = matchedSkillNames[i];
    const skill = index[name];
    if (!skill) continue;

    parts.push(`### ${skill.name}\n`);
    parts.push(skill.content);

    // For top match only: include up to 2 most relevant references (truncated)
    if (i === 0 && skill.refCount > 0) {
      const refNames = Object.keys(skill.references).slice(0, 2);
      for (const rn of refNames) {
        const refContent = skill.references[rn];
        // Truncate long references to ~2000 chars
        const truncated = refContent.length > 2000
          ? refContent.slice(0, 2000) + '\n\n[... truncated for brevity]'
          : refContent;
        parts.push(`\n#### Reference: ${rn}\n${truncated}\n`);
      }
    }

    parts.push('\n---\n');
  }

  return parts.join('\n');
}

/**
 * Get all available skill names and descriptions for the UI.
 */
export function listAvailableSkills() {
  const index = loadSkillIndex();
  return Object.entries(index).map(([id, skill]) => ({
    id,
    name: skill.name,
    description: skill.description,
    refCount: skill.refCount
  }));
}

/**
 * Get full content of a specific skill (for manual loading).
 */
export function getSkillContent(skillName) {
  const index = loadSkillIndex();
  return index[skillName] || null;
}
