// WP-CLI tools definition for Claude API tool_use
// Each tool maps to a WP-CLI command

export const wpCliTools = [
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
    name: 'wp_site_health',
    description: 'Run a quick health check: core version, active theme, active plugins count, users count.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    },
    buildCommand: () => 'wp eval "echo json_encode([\'wp_version\' => get_bloginfo(\'version\'), \'site_name\' => get_bloginfo(\'name\'), \'site_url\' => get_site_url(), \'theme\' => wp_get_theme()->get(\'Name\'), \'active_plugins\' => count(get_option(\'active_plugins\')), \'users\' => count_users()[\'total_users\']]);"'
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
