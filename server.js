const express = require('express');
const path = require('path');
const fs = require('fs');
const { callAI } = require('./lib/ai');
const { fetchPublicRepos, formatReposForPrompt } = require('./lib/github');
const { buildTailorPrompt, buildRefinePrompt } = require('./lib/prompt');
const { parseResponse, extractSection } = require('./lib/parser');
const { buildDocx } = require('./lib/docx-builder');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, 'output');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/tailor — generate tailored resume + cover letter
app.post('/api/tailor', async (req, res) => {
  const { jobTitle, company, jobDescription, engine = 'claude' } = req.body;

  if (!jobTitle || !company || !jobDescription) {
    return res.status(400).json({ error: 'jobTitle, company, and jobDescription are required' });
  }

  try {
    // Fetch GitHub repos
    let githubRepos = '(GitHub fetch skipped)';
    try {
      const repos = await fetchPublicRepos();
      githubRepos = formatReposForPrompt(repos);
    } catch (err) {
      console.error('GitHub fetch failed, continuing without repos:', err.message);
    }

    // Build prompt and call AI
    const prompt = buildTailorPrompt({ jobTitle, company, jobDescription, githubRepos });
    console.log(`Calling ${engine} for ${jobTitle} at ${company}...`);
    const response = await callAI(prompt, engine);

    // Parse response
    const { resume, coverLetter } = parseResponse(response);

    // Generate DOCX files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '_');

    const resumeFilename = `resume_${safeCompany}_${timestamp}.docx`;
    const coverLetterFilename = `cover_letter_${safeCompany}_${timestamp}.docx`;

    const resumeBuffer = await buildDocx(resume, `Resume - ${company}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, resumeFilename), resumeBuffer);

    let coverLetterBuffer = null;
    if (coverLetter) {
      coverLetterBuffer = await buildDocx(coverLetter, `Cover Letter - ${company}`);
      fs.writeFileSync(path.join(OUTPUT_DIR, coverLetterFilename), coverLetterBuffer);
    }

    res.json({
      resume,
      coverLetter,
      resumeFilename,
      coverLetterFilename: coverLetter ? coverLetterFilename : null
    });
  } catch (err) {
    console.error('Tailor error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/refine — refine resume or cover letter based on feedback
app.post('/api/refine', async (req, res) => {
  const { currentMarkdown, feedback, type = 'resume', engine = 'claude' } = req.body;

  if (!currentMarkdown || !feedback) {
    return res.status(400).json({ error: 'currentMarkdown and feedback are required' });
  }

  if (type !== 'resume' && type !== 'coverLetter') {
    return res.status(400).json({ error: 'type must be "resume" or "coverLetter"' });
  }

  try {
    const prompt = buildRefinePrompt({ currentMarkdown, feedback, type });
    console.log(`Refining ${type} via ${engine}...`);
    const response = await callAI(prompt, engine);

    // Extract the refined content
    const startMarker = type === 'resume' ? '---RESUME_START---' : '---COVER_LETTER_START---';
    const endMarker = type === 'resume' ? '---RESUME_END---' : '---COVER_LETTER_END---';
    let refined = extractSection(response, startMarker, endMarker);
    if (!refined) refined = response.trim();

    // Generate updated DOCX
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const typeLabel = type === 'resume' ? 'resume' : 'cover_letter';
    const filename = `${typeLabel}_refined_${timestamp}.docx`;

    const buffer = await buildDocx(refined, type === 'resume' ? 'Resume (Refined)' : 'Cover Letter (Refined)');
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);

    res.json({
      markdown: refined,
      filename
    });
  } catch (err) {
    console.error('Refine error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/download/:filename — download DOCX
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Resume Tailor running at http://localhost:${PORT}`);
});
