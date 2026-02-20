/**
 * Assembles prompts for the AI engine.
 * Based on career-agent's GeminiLlmService.BuildPrompt pattern.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadDataFile(filename) {
  return fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
}

function buildTailorPrompt({ jobTitle, company, jobDescription, githubRepos, baseResumeFile, baseCoverLetterFile }) {
  const resume = loadDataFile(baseResumeFile || 'resume.md');
  const coverLetter = loadDataFile(baseCoverLetterFile || 'cover-letter.md');

  return `You are an expert resume writer and career coach. You tailor resumes and cover letters to match specific job descriptions while maintaining truthfulness. You respond ONLY with the requested structured output, no commentary.

## My Current Resume (Markdown)

${resume}

## My Cover Letter Template

${coverLetter}

## My GitHub Portfolio

${githubRepos}

## Target Job

**Title:** ${jobTitle}
**Company:** ${company}

**Job Description:**
${jobDescription}

## Instructions

1. **Tailored Resume**: Rewrite my resume in Markdown format, optimized for this specific role:
   - Reorder and emphasize skills/experience that match the job description
   - Use keywords from the job description naturally
   - Keep all information truthful — do not invent experience or skills I don't have
   - Maintain professional formatting with clear sections
   - Reference relevant GitHub portfolio projects where they strengthen the application

2. **Cover Letter**: Write a concise, compelling cover letter in Markdown (plain text style, not formatted with headers):
   - Address why I'm a strong fit for this specific role
   - Reference 2-3 specific achievements from my resume that align with the job
   - Reference 1-2 relevant GitHub repos that demonstrate relevant skills
   - Keep it under 400 words
   - Professional but not overly formal tone
   - Include my contact info header and sign-off

## Required Output Format

Respond with EXACTLY this structure (including the delimiter markers):

---RESUME_START---
[Your tailored resume in Markdown here]
---RESUME_END---

---COVER_LETTER_START---
[Your cover letter in plain text/Markdown here]
---COVER_LETTER_END---`;
}

function buildRefinePrompt({ currentMarkdown, feedback, type }) {
  const typeLabel = type === 'resume' ? 'Resume' : 'Cover Letter';
  const startMarker = type === 'resume' ? '---RESUME_START---' : '---COVER_LETTER_START---';
  const endMarker = type === 'resume' ? '---RESUME_END---' : '---COVER_LETTER_END---';

  return `You are an expert resume writer and career coach. You are refining a previously tailored ${typeLabel.toLowerCase()} based on user feedback.

## Current ${typeLabel}

${currentMarkdown}

## User Feedback

${feedback}

## Instructions

Apply the user's feedback to improve the ${typeLabel.toLowerCase()}. Keep all information truthful. Maintain professional formatting.

## Required Output Format

Respond with EXACTLY this structure:

${startMarker}
[Your revised ${typeLabel.toLowerCase()} in Markdown here]
${endMarker}`;
}

function buildCompanyExtractionPrompt(text) {
  return `Extract the company or employer name from the following job description text. 
Respond ONLY with the company name. If you cannot find it, respond with "UNKNOWN".

Job Description:
${text.slice(0, 2000)}`;
}

module.exports = { buildTailorPrompt, buildRefinePrompt, buildCompanyExtractionPrompt };
