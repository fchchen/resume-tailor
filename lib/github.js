/**
 * Fetches public GitHub repos via gh CLI.
 */

const { execFile } = require('child_process');

function execGh(args) {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`gh failed: ${error.message}\nstderr: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function fetchPublicRepos(username = 'fchchen') {
  const reposJson = await execGh([
    'repo', 'list', username, '--public',
    '--json', 'name,description,primaryLanguage',
    '--limit', '20'
  ]);

  const repos = JSON.parse(reposJson);
  const results = [];

  for (const repo of repos) {
    let readme = '';
    try {
      const readmeJson = await execGh([
        'api', `repos/${username}/${repo.name}/readme`,
        '--jq', '.content'
      ]);
      // GitHub API returns base64-encoded content
      readme = Buffer.from(readmeJson.trim(), 'base64').toString('utf-8');
      // Truncate long READMEs to keep prompt manageable
      if (readme.length > 1000) {
        readme = readme.slice(0, 1000) + '\n...(truncated)';
      }
    } catch {
      // No README or API error — skip
    }

    results.push({
      name: repo.name,
      description: repo.description || '',
      language: repo.primaryLanguage?.name || '',
      readme
    });
  }

  return results;
}

function formatReposForPrompt(repos) {
  if (!repos.length) return '(No public repositories found)';

  return repos.map(r => {
    let entry = `### ${r.name}`;
    if (r.language) entry += ` (${r.language})`;
    entry += '\n';
    if (r.description) entry += `${r.description}\n`;
    if (r.readme) entry += `\nREADME excerpt:\n${r.readme}\n`;
    return entry;
  }).join('\n');
}

module.exports = { fetchPublicRepos, formatReposForPrompt };
