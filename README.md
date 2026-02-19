# Resume Tailor

Web app that tailors your resume and cover letter to specific job descriptions using AI. Paste a job description, get back a customized resume and cover letter — downloadable as DOCX.

## Features

- Tailors resume content and keywords to match job descriptions
- Generates a matching cover letter
- Pulls GitHub portfolio projects to strengthen applications
- Download results as DOCX
- Refine results with follow-up feedback
- Multiple AI engines: Claude, Gemini, Codex

## Setup

```bash
npm install
```

Requires at least one AI CLI installed:
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude`)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini`)
- [Codex CLI](https://github.com/openai/codex) (`codex`)

## Usage

```bash
npm start
```

Open http://localhost:3000, select an AI engine, enter the job title and company, paste the job description, and hit Generate.

## Project Structure

```
server.js          Express server + API routes
lib/
  ai.js            AI engine wrapper (Claude, Gemini, Codex)
  prompt.js        Prompt builder
  parser.js        Response parser (delimiter-based)
  github.js        GitHub repo fetcher
  docx-builder.js  DOCX generation
data/
  resume.md        Base resume
  cover-letter.md  Base cover letter
public/
  index.html       Frontend
  app.js           Frontend logic
  style.css        Styles
output/            Generated DOCX files (git-ignored)
```
