// WP-CLI executor — runs commands locally or via SSH
import { exec } from 'child_process';

const TIMEOUT_MS = 60000;

export function executeWpCli(command, site) {
  return new Promise((resolve, reject) => {
    let fullCommand;

    if (site.type === 'remote' && site.ssh_host) {
      // Remote: SSH + WP-CLI
      const sshTarget = site.ssh_user ? `${site.ssh_user}@${site.ssh_host}` : site.ssh_host;
      const remotePath = site.path ? ` --path=${site.path}` : '';
      fullCommand = `ssh ${sshTarget} "${command}${remotePath}"`;
    } else {
      // Local: WP-CLI with --path
      fullCommand = `${command} --path="${site.path}"`;
    }

    console.log(`  [wp-cli] ${fullCommand}`);

    exec(fullCommand, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // WP-CLI often returns useful info in stderr
        const output = stderr || error.message;
        resolve({ success: false, output: output.trim(), command: fullCommand });
        return;
      }

      let parsed = stdout.trim();

      // Try to parse JSON output
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // Keep as string if not JSON
      }

      resolve({ success: true, output: parsed, command: fullCommand });
    });
  });
}

export async function checkWpCli() {
  return new Promise((resolve) => {
    exec('wp --version', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ installed: false, message: 'WP-CLI no esta instalado. Instala: brew install wp-cli (macOS) o visita https://wp-cli.org' });
      } else {
        resolve({ installed: true, version: stdout.trim() });
      }
    });
  });
}

export async function testConnection(site) {
  try {
    // For local sites, check WP-CLI first
    if (!site.ssh_host) {
      const wpCheck = await checkWpCli();
      if (!wpCheck.installed) {
        return { connected: false, version: null, error: wpCheck.message };
      }
    }
    const result = await executeWpCli('wp core version', site);
    return {
      connected: result.success,
      version: result.success ? result.output : null,
      error: result.success ? null : result.output
    };
  } catch (e) {
    return { connected: false, version: null, error: e.message };
  }
}
