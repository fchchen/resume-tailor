/**
 * Unified AI wrapper — calls claude -p, codex exec, or gemini -p as subprocess.
 * Prompts are piped via stdin to avoid OS argument-length limits.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TIMEOUT_MS = 180_000;

function spawnWithStdin(command, args, prompt, envOverrides = {}, spawnOpts = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...envOverrides };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn(command, args, { env, timeout: TIMEOUT_MS, ...spawnOpts });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('error', (err) => {
      reject(new Error(`${command} failed to start: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} was killed by ${signal} (likely timed out after ${TIMEOUT_MS / 1000}s)`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}\nstderr: ${stderr}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function callClaude(prompt) {
  // Run from tmpdir to avoid project detection; pipe prompt via stdin.
  return spawnWithStdin('claude', ['-p', '', '--output-format', 'text'], prompt, {}, { cwd: os.tmpdir() });
}

function callGemini(prompt) {
  // Run from tmpdir so Gemini CLI doesn't detect the project directory
  // and try to use agentic tools (read_file, etc.)
  return spawnWithStdin('gemini', ['-p', '', '--output-format', 'text', '--sandbox'], prompt, {}, { cwd: os.tmpdir() });
}

function callCodex(prompt) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(os.tmpdir(), `codex-output-${Date.now()}.txt`);

    const child = spawn('codex', ['exec', '-o', outputFile, '--full-auto'], {
      timeout: TIMEOUT_MS
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('error', (err) => {
      reject(new Error(`codex exec failed to start: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`codex exec was killed by ${signal} (likely timed out after ${TIMEOUT_MS / 1000}s)`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`codex exec exited with code ${code}\nstderr: ${stderr}`));
        return;
      }
      try {
        const result = fs.readFileSync(outputFile, 'utf-8');
        fs.unlinkSync(outputFile);
        resolve(result);
      } catch (readErr) {
        resolve(stdout);
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callAI(prompt, engine = 'claude') {
  if (engine === 'codex') {
    return callCodex(prompt);
  } else if (engine === 'gemini') {
    return callGemini(prompt);
  }
  return callClaude(prompt);
}

module.exports = { callAI };
