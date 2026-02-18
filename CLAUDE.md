# Resume Tailor

Lightweight web app that tailors resumes and cover letters to job descriptions using `claude -p` subprocess.

## Tech Stack
- Node.js + Express backend
- Plain HTML/CSS/JS frontend
- `claude -p` or `codex exec` for AI (no API keys needed)
- `docx` npm package for DOCX generation

## Key Patterns
- AI calls use `execFile` with env stripped of CLAUDECODE/CLAUDE_CODE_ENTRYPOINT (same fix as agent-check)
- Response parsing uses delimiter markers: `---RESUME_START---`/`---RESUME_END---` and `---COVER_LETTER_START---`/`---COVER_LETTER_END---`
- DOCX files saved to output/ directory (git-ignored)

## Commands
- `npm start` — start server on port 3000
- `npm test` — no tests yet

## Project Structure
- `server.js` — Express server + API routes
- `lib/` — AI wrapper, GitHub fetcher, prompt builder, response parser, DOCX builder
- `data/` — Base resume and cover letter markdown
- `public/` — Frontend static files
- `output/` — Generated DOCX files (git-ignored)
