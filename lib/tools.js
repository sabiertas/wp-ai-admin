// WP-CLI tools definition for Claude API tool_use
// The generic wp_cli_run tool allows ANY WP-CLI command.
// The specific tools serve as "hints" so Claude knows common operations.

export const wpCliTools = [
  // ==================== GENERIC — THE POWER TOOL ====================
  {
    name: 'wp_cli_run',
    description: `Execute ANY WP-CLI command. Use this when no specific tool fits, or for advanced operations.
The command should start with "wp" (e.g. "wp plugin list", "wp db export", "wp eval '...php code...'").
You have full access to the entire WP-CLI command set including:
- wp core, wp plugin, wp theme, wp post, wp user, wp option, wp menu, wp widget
- wp db (export, import, query, optimize, repair, search, tables, size)
- wp media (import, regenerate, fix-orientation)
- wp cron (event list/run/delete, schedule list)
- wp rewrite (flush, list, structure)
- wp transient (delete, get, set, list, type)
- wp cache (flush, add, get, set, delete)
- wp config (get, set, list, path, create, edit, has, delete, shuffle-salts)
- wp search-replace (with --dry-run for safety)
- wp eval / wp eval-file (run arbitrary PHP)
- wp scaffold (plugin, theme, child-theme, block, post-type, taxonomy)
- wp server, wp maintenance-mode, wp language, wp role, wp cap
- wp comment, wp term, wp taxonomy, wp sidebar
- wp wc (WooCommerce if installed)
- And any custom commands from plugins
Add --format=json for structured output when listing data. The --path flag is added automatically.`,
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Full WP-CLI command to execute (e.g. "wp plugin list --status=active --format=json", "wp db size --tables --format=json", "wp eval \'echo home_url();\'")'
        }
      },
      required: ['command']
    },
    buildCommand: (input) => input.command.replace(/^wp\s+/, 'wp ')
  },

  // ==================== SPECIFIC TOOLS (hints for common ops) ====================
  {
    name: 'wp_plugin_list',
    description: 'List all installed plugins with their status (active/inactive), version, and update availability. Use this to check what plugins are installed on a WordPress site.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'must-use', 'dropin'],
          description: 'Filter by plugin status. Omit to show all.'
        }
      },
      required: []
    },
    buildCommand: (input) => {
      let cmd = 'wp plugin list --format=json';
      if (input.status) cmd += ` --status=${input.status}`;
      return cmd;
    }
  },
  {
    name: 'wp_plugin_activate',
    description: 'Activate a WordPress plugin by its slug.',
    input_schema: {
      type: 'object',
      properties: {
        plugin: { type: 'string', description: 'Plugin slug (e.g. "akismet", "woocommerce")' }
      },
      required: ['plugin']
    },
    buildCommand: (input) => `wp plugin activate ${input.plugin}`,
    destructive: true
  },
  {
    name: 'wp_plugin_deactivate',
    description: 'Deactivate a WordPress plugin by its slug.',
    input_schema: {
      type: 'object',
      properties: {
        plugin: { type: 'string', description: 'Plugin slug' }
      },
      required: ['plugin']
    },
    buildCommand: (input) => `wp plugin deactivate ${input.plugin}`,
    destructive: true
  },
  {
    name: 'wp_post_list',
    description: 'List WordPress posts with title, status, date, and ID. Can filter by post type and status.',
    input_schema: {
      type: 'object',
      properties: {
        post_type: { type: 'string', description: 'Post type (post, page, or custom). Default: post', default: 'post' },
        post_status: { type: 'string', enum: ['publish', 'draft', 'pending', 'private', 'trash', 'any'], description: 'Filter by status' },
        posts_per_page: { type: 'number', description: 'Number of posts to return. Default: 10', default: 10 }
      },
      required: []
    },
    buildCommand: (input) => {
      const type = input.post_type || 'post';
      const limit = input.posts_per_page || 10;
      let cmd = `wp post list --post_type=${type} --posts_per_page=${limit} --format=json --fields=ID,post_title,post_status,post_date`;
      if (input.post_status) cmd += ` --post_status=${input.post_status}`;
      return cmd;
    }
  },
  {
    name: 'wp_user_list',
    description: 'List all WordPress users with their roles, email, and login.',
    input_schema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Filter by role (administrator, editor, author, subscriber, etc.)' }
      },
      required: []
    },
    buildCommand: (input) => {
      let cmd = 'wp user list --format=json --fields=ID,user_login,user_email,roles';
      if (input.role) cmd += ` --role=${input.role}`;
      return cmd;
    }
  },
  {
    name: 'wp_core_version',
    description: 'Get the WordPress core version and check for updates.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp core version'
  },
  {
    name: 'wp_option_get',
    description: 'Get a WordPress option value (e.g. blogname, siteurl, admin_email).',
    input_schema: {
      type: 'object',
      properties: {
        option: { type: 'string', description: 'Option name (e.g. "blogname", "siteurl", "admin_email")' }
      },
      required: ['option']
    },
    buildCommand: (input) => `wp option get ${input.option}`
  },
  {
    name: 'wp_theme_list',
    description: 'List installed themes with status and version.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp theme list --format=json'
  },
  {
    name: 'wp_post_create',
    description: 'Create a new WordPress post or page with a title, content, and status.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Post title' },
        content: { type: 'string', description: 'Post content (HTML or plain text)' },
        post_type: { type: 'string', description: 'Post type: post or page. Default: post', default: 'post' },
        post_status: { type: 'string', enum: ['publish', 'draft', 'pending', 'private'], description: 'Post status. Default: draft', default: 'draft' }
      },
      required: ['title']
    },
    buildCommand: (input) => {
      const type = input.post_type || 'post';
      const status = input.post_status || 'draft';
      const content = input.content || '';
      return `wp post create --post_title="${input.title.replace(/"/g, '\\"')}" --post_type=${type} --post_status=${status} --post_content="${content.replace(/"/g, '\\"')}" --porcelain`;
    },
    destructive: true
  },
  {
    name: 'wp_db_export',
    description: 'Export the WordPress database to a SQL file for backup.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Output filename. Default: auto-generated with timestamp.' }
      },
      required: []
    },
    buildCommand: (input) => {
      const filename = input.filename || `backup-${new Date().toISOString().slice(0, 10)}.sql`;
      return `wp db export ${filename}`;
    },
    destructive: true
  },
  {
    name: 'wp_search_replace',
    description: 'Search and replace text in the WordPress database. Useful for URL changes or content updates. Always runs with --dry-run first unless explicitly told otherwise.',
    input_schema: {
      type: 'object',
      properties: {
        old_value: { type: 'string', description: 'Text to search for' },
        new_value: { type: 'string', description: 'Text to replace with' },
        dry_run: { type: 'boolean', description: 'If true (default), only shows what would change without making changes', default: true }
      },
      required: ['old_value', 'new_value']
    },
    buildCommand: (input) => {
      const dryRun = input.dry_run !== false ? ' --dry-run' : '';
      return `wp search-replace "${input.old_value.replace(/"/g, '\\"')}" "${input.new_value.replace(/"/g, '\\"')}"${dryRun}`;
    },
    destructive: true
  },
  {
    name: 'wp_site_health',
    description: 'Run a quick health check: core version, active theme, active plugins count, users count.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp eval "echo json_encode([\'wp_version\' => get_bloginfo(\'version\'), \'site_name\' => get_bloginfo(\'name\'), \'site_url\' => get_site_url(), \'theme\' => wp_get_theme()->get(\'Name\'), \'active_plugins\' => count(get_option(\'active_plugins\')), \'users\' => count_users()[\'total_users\']]);"'
  },

  // ==================== POST MANAGEMENT ====================
  {
    name: 'wp_post_update',
    description: 'Update an existing WordPress post or page. Can change title, content, status, or excerpt.',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'number', description: 'The post ID to update' },
        title: { type: 'string', description: 'New post title' },
        content: { type: 'string', description: 'New post content' },
        post_status: { type: 'string', enum: ['publish', 'draft', 'pending', 'private', 'trash'], description: 'New status' },
        excerpt: { type: 'string', description: 'Post excerpt' }
      },
      required: ['post_id']
    },
    buildCommand: (input) => {
      let cmd = `wp post update ${input.post_id}`;
      if (input.title) cmd += ` --post_title="${input.title.replace(/"/g, '\\"')}"`;
      if (input.content) cmd += ` --post_content="${input.content.replace(/"/g, '\\"')}"`;
      if (input.post_status) cmd += ` --post_status=${input.post_status}`;
      if (input.excerpt) cmd += ` --post_excerpt="${input.excerpt.replace(/"/g, '\\"')}"`;
      return cmd;
    },
    destructive: true
  },
  {
    name: 'wp_post_delete',
    description: 'Delete a WordPress post or page by ID. Moves to trash by default, use force to permanently delete.',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'number', description: 'The post ID to delete' },
        force: { type: 'boolean', description: 'Skip trash and permanently delete. Default: false', default: false }
      },
      required: ['post_id']
    },
    buildCommand: (input) => {
      let cmd = `wp post delete ${input.post_id}`;
      if (input.force) cmd += ' --force';
      return cmd;
    },
    destructive: true
  },
  {
    name: 'wp_post_get',
    description: 'Get full details of a specific post or page by ID, including content, meta, and all fields.',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'number', description: 'The post ID' }
      },
      required: ['post_id']
    },
    buildCommand: (input) => `wp post get ${input.post_id} --format=json`
  },

  // ==================== PLUGIN MANAGEMENT ====================
  {
    name: 'wp_plugin_install',
    description: 'Install a WordPress plugin from the official repository by slug. Can optionally activate it.',
    input_schema: {
      type: 'object',
      properties: {
        plugin: { type: 'string', description: 'Plugin slug from wordpress.org (e.g. "wordfence", "contact-form-7")' },
        activate: { type: 'boolean', description: 'Activate after install. Default: false', default: false }
      },
      required: ['plugin']
    },
    buildCommand: (input) => {
      let cmd = `wp plugin install ${input.plugin}`;
      if (input.activate) cmd += ' --activate';
      return cmd;
    },
    destructive: true
  },
  {
    name: 'wp_plugin_update',
    description: 'Update one or all plugins. Use "all" to update everything.',
    input_schema: {
      type: 'object',
      properties: {
        plugin: { type: 'string', description: 'Plugin slug or "all" to update all plugins', default: 'all' }
      },
      required: []
    },
    buildCommand: (input) => {
      const target = input.plugin || '--all';
      return `wp plugin update ${target === 'all' ? '--all' : target}`;
    },
    destructive: true
  },
  {
    name: 'wp_plugin_search',
    description: 'Search the WordPress.org plugin directory for plugins by keyword.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search keyword (e.g. "seo", "cache", "security")' },
        per_page: { type: 'number', description: 'Number of results. Default: 5', default: 5 }
      },
      required: ['search']
    },
    buildCommand: (input) => {
      const limit = input.per_page || 5;
      return `wp plugin search "${input.search}" --per-page=${limit} --format=json --fields=name,slug,rating,num_ratings,active_installs`;
    }
  },

  // ==================== USER MANAGEMENT ====================
  {
    name: 'wp_user_create',
    description: 'Create a new WordPress user with login, email, and role.',
    input_schema: {
      type: 'object',
      properties: {
        login: { type: 'string', description: 'Username' },
        email: { type: 'string', description: 'User email' },
        role: { type: 'string', description: 'User role (administrator, editor, author, contributor, subscriber). Default: subscriber', default: 'subscriber' },
        password: { type: 'string', description: 'Password. If omitted, WP generates one.' }
      },
      required: ['login', 'email']
    },
    buildCommand: (input) => {
      let cmd = `wp user create ${input.login} ${input.email} --role=${input.role || 'subscriber'}`;
      if (input.password) cmd += ` --user_pass="${input.password}"`;
      cmd += ' --porcelain';
      return cmd;
    },
    destructive: true
  },

  // ==================== OPTIONS ====================
  {
    name: 'wp_option_update',
    description: 'Update a WordPress option value (e.g. blogname, blogdescription, admin_email, permalink_structure).',
    input_schema: {
      type: 'object',
      properties: {
        option: { type: 'string', description: 'Option name' },
        value: { type: 'string', description: 'New value' }
      },
      required: ['option', 'value']
    },
    buildCommand: (input) => `wp option update ${input.option} "${input.value.replace(/"/g, '\\"')}"`,
    destructive: true
  },
  {
    name: 'wp_option_list',
    description: 'List WordPress options, optionally filtered by search term. Useful to find option names.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term to filter options (e.g. "mail", "seo", "woo")' }
      },
      required: []
    },
    buildCommand: (input) => {
      let cmd = 'wp option list --format=json --fields=option_name,option_value';
      if (input.search) cmd += ` --search="*${input.search}*"`;
      return cmd;
    }
  },

  // ==================== CACHE & MAINTENANCE ====================
  {
    name: 'wp_cache_flush',
    description: 'Flush the WordPress object cache. Useful after making changes or troubleshooting.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp cache flush'
  },
  {
    name: 'wp_transient_delete',
    description: 'Delete transients from the database. Use "all" to clear all transients, or specify a name.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Transient name, or omit to delete all expired transients' },
        all: { type: 'boolean', description: 'Delete ALL transients (not just expired). Default: false', default: false }
      },
      required: []
    },
    buildCommand: (input) => {
      if (input.name) return `wp transient delete ${input.name}`;
      if (input.all) return 'wp transient delete --all';
      return 'wp transient delete --expired';
    }
  },
  {
    name: 'wp_rewrite_flush',
    description: 'Flush and regenerate WordPress rewrite rules (permalinks). Fixes 404 errors on custom post types.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp rewrite flush'
  },
  {
    name: 'wp_maintenance_mode',
    description: 'Enable or disable WordPress maintenance mode.',
    input_schema: {
      type: 'object',
      properties: {
        enable: { type: 'boolean', description: 'true to enable maintenance mode, false to disable' }
      },
      required: ['enable']
    },
    buildCommand: (input) => {
      if (input.enable) {
        return 'wp eval "file_put_contents(ABSPATH.\'.maintenance\', \'<?php $upgrading = time(); ?>\');"';
      }
      return 'wp eval "if(file_exists(ABSPATH.\'.maintenance\')){unlink(ABSPATH.\'.maintenance\');echo \'Maintenance mode disabled.\';} else {echo \'Not in maintenance mode.\';}"';
    },
    destructive: true
  },

  // ==================== CRON & SCHEDULED TASKS ====================
  {
    name: 'wp_cron_list',
    description: 'List all scheduled WordPress cron events with their next run time and recurrence.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp cron event list --format=json --fields=hook,next_run_relative,recurrence'
  },

  // ==================== MEDIA ====================
  {
    name: 'wp_media_list',
    description: 'List media attachments (images, files) with URL, type, and date.',
    input_schema: {
      type: 'object',
      properties: {
        mime_type: { type: 'string', description: 'Filter by MIME type (e.g. "image", "image/jpeg", "application/pdf")' },
        posts_per_page: { type: 'number', description: 'Number of items. Default: 10', default: 10 }
      },
      required: []
    },
    buildCommand: (input) => {
      const limit = input.posts_per_page || 10;
      let cmd = `wp post list --post_type=attachment --posts_per_page=${limit} --format=json --fields=ID,post_title,post_mime_type,guid,post_date`;
      if (input.mime_type) cmd += ` --post_mime_type=${input.mime_type}`;
      return cmd;
    }
  },

  // ==================== PHP EVAL (POWER TOOL) ====================
  {
    name: 'wp_eval',
    description: 'Execute arbitrary PHP code in the WordPress context. Extremely powerful — use for anything WP-CLI does not have a direct command for. Always echo/print results. Example: wp eval "echo get_option(\'active_plugins\');"',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'PHP code to execute. Must include echo/print for output. Runs inside WordPress context with full access to WP functions.' }
      },
      required: ['code']
    },
    buildCommand: (input) => {
      const escaped = input.code.replace(/"/g, '\\"');
      return `wp eval "${escaped}"`;
    },
    destructive: true
  }
];

export function getToolDefinitions() {
  return wpCliTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema
  }));
}

export function findTool(name) {
  return wpCliTools.find(t => t.name === name);
}
