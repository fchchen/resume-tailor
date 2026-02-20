// Simple in-memory cache
let repoCache = null;
let lastFetch = 0;
const CACHE_TTL = 3600_000; // 1 hour

async function fetchPublicRepos() {
  const now = Date.now();
  if (repoCache && (now - lastFetch < CACHE_TTL)) {
    console.log('Using cached GitHub repositories');
    return repoCache;
  }

  const username = 'fchchen'; // Should ideally be an env var
  const url = `https://api.github.com/users/${username}/repos?sort=updated&per_page=10`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  repoCache = data.map(repo => ({
    name: repo.name,
    description: repo.description,
    stars: repo.stargazers_count,
    url: repo.html_url,
    language: repo.language
  }));
  
  lastFetch = now;
  return repoCache;
}

function formatReposForPrompt(repos) {
  if (!repos || repos.length === 0) return 'No public repositories found.';
  
  return repos.map(repo => {
    return `- ${repo.name}: ${repo.description || 'No description'} (${repo.language || 'Various'}, ${repo.stars} stars) - ${repo.url}`;
  }).join('\n');
}

module.exports = { fetchPublicRepos, formatReposForPrompt };
