const { parseResponse, extractSection } = require('./lib/parser');
const assert = require('assert');

console.log('--- Testing lib/parser.js ---');

const mockResponse = 'Intro text...\n\n---RESUME_START---\n# My Tailored Resume\n---RESUME_END---\n\nBetween text...\n\n---COVER_LETTER_START---\nDear Hiring Manager,\n---COVER_LETTER_END---\n\nOutro text...';

const parsed = parseResponse(mockResponse);

try {
  assert.strictEqual(parsed.resume, '# My Tailored Resume', 'Resume parsing failed');
  assert.strictEqual(parsed.coverLetter, 'Dear Hiring Manager,', 'Cover letter parsing failed');
  console.log('OK: Parser extracts resume and cover letter.');
} catch (err) {
  console.error('FAIL: Parser test:', err.message);
  process.exit(1);
}

const mockRefine = '---RESUME_START---\n# Refined Resume\n---RESUME_END---';
const refined = extractSection(mockRefine, '---RESUME_START---', '---RESUME_END---');
try {
  assert.strictEqual(refined, '# Refined Resume', 'Refine extraction failed');
  console.log('OK: Parser extracts refined section.');
} catch (err) {
  console.error('FAIL: Refine test:', err.message);
  process.exit(1);
}

console.log('\n--- Testing lib/prompt.js ---');
const { buildTailorPrompt } = require('./lib/prompt');
const prompt = buildTailorPrompt({ 
  jobTitle: 'Software Engineer', 
  company: 'Acme', 
  jobDescription: 'Write code.',
  githubRepos: 'repo1, repo2'
});

try {
  assert(prompt.includes('Software Engineer'), 'Prompt missing job title');
  assert(prompt.includes('Acme'), 'Prompt missing company');
  assert(prompt.includes('repo1, repo2'), 'Prompt missing github repos');
  console.log('OK: Prompt assembles all fields.');
} catch (err) {
  console.error('FAIL: Prompt test:', err.message);
  process.exit(1);
}

console.log('\n--- Testing Company Extraction Prompt ---');
const { buildCompanyExtractionPrompt } = require('./lib/prompt');
const extractionPrompt = buildCompanyExtractionPrompt('We are looking for a developer at Google.');
try {
  assert(extractionPrompt.includes('Extract the company'), 'Extraction prompt missing instruction');
  assert(extractionPrompt.includes('Google'), 'Extraction prompt missing JD text');
  console.log('OK: Extraction prompt correctly built.');
} catch (err) {
  console.error('FAIL: Extraction prompt test:', err.message);
  process.exit(1);
}

console.log('\n--- All unit tests passed! ---');
