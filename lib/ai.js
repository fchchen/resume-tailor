/**
 * Unified AI wrapper — calls claude -p or codex exec as subprocess.
 * Same pattern as agent-check/agent-check.sh line 72.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TIMEOUT_MS = 120_000;

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    // Strip CLAUDECODE/CLAUDE_CODE_ENTRYPOINT from env (same fix as agent-check)
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    execFile('claude', ['-p', prompt, '--output-format', 'text'], {
      env,
      timeout: TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`claude -p failed: ${error.message}\nstderr: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function callCodex(prompt) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(os.tmpdir(), `codex-output-${Date.now()}.txt`);

    execFile('codex', ['exec', prompt, '-o', outputFile, '--full-auto'], {
      timeout: TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`codex exec failed: ${error.message}\nstderr: ${stderr}`));
        return;
      }
      try {
        const result = fs.readFileSync(outputFile, 'utf-8');
        fs.unlinkSync(outputFile);
        resolve(result);
      } catch (readErr) {
        // Fall back to stdout if output file doesn't exist
        resolve(stdout);
      }
    });
  });
}

async function callAI(prompt, engine = 'claude') {
  if (engine === 'codex') {
    return callCodex(prompt);
  }
  return callClaude(prompt);
}

module.exports = { callAI };
