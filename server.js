const express = require('express');
const path = require('path');
const fs = require('fs');
const { callAI } = require('./lib/ai');
const { fetchPublicRepos, formatReposForPrompt } = require('./lib/github');
const { buildTailorPrompt, buildRefinePrompt } = require('./lib/prompt');
const { parseResponse, extractSection } = require('./lib/parser');
const { buildDocx } = require('./lib/docx-builder');
const { buildPdf } = require('./lib/pdf-builder');
const { scrapeJD } = require('./lib/scraper');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_DIR = path.join(__dirname, 'data');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/data-files — list files in data directory
app.get('/api/data-files', (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.md'));
  res.json({ files });
});

// POST /api/tailor — generate tailored resume + cover letter
app.post('/api/tailor', async (req, res) => {
  let { jobTitle, company, jobDescription, jobUrl, engine = 'claude', baseResume, baseCoverLetter } = req.body;

  if (jobUrl && !jobDescription) {
    try {
      console.log(`Scraping JD from: ${jobUrl}`);
      jobDescription = await scrapeJD(jobUrl);
    } catch (err) {
      return res.status(400).json({ error: `Failed to fetch JD from URL: ${err.message}` });
    }
  }

  if (!jobTitle || !company || !jobDescription) {
    return res.status(400).json({ error: 'jobTitle, company, and jobDescription (or jobUrl) are required' });
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
    const prompt = buildTailorPrompt({ 
      jobTitle, 
      company, 
      jobDescription, 
      githubRepos,
      baseResumeFile: baseResume,
      baseCoverLetterFile: baseCoverLetter
    });
    
    const engines = Array.isArray(engine) ? engine : [engine];
    const results = {};

    const settlements = await Promise.allSettled(engines.map(async (eng) => {
      console.log(`Calling ${eng} for ${jobTitle} at ${company}...`);
      const response = await callAI(prompt, eng);
      const { resume, coverLetter } = parseResponse(response);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '_');
      const resumeFilename = `resume_${eng}_${safeCompany}_${timestamp}.docx`;
      const resumePdfName = `resume_${eng}_${safeCompany}_${timestamp}.pdf`;
      const coverLetterFilename = `cover_letter_${eng}_${safeCompany}_${timestamp}.docx`;
      const coverLetterPdfName = `cover_letter_${eng}_${safeCompany}_${timestamp}.pdf`;

      const resumeBuffer = await buildDocx(resume, `Resume - ${company} (${eng})`);
      fs.writeFileSync(path.join(OUTPUT_DIR, resumeFilename), resumeBuffer);

      const resumePdfBuffer = await buildPdf(resume, `Resume - ${company} (${eng})`);
      fs.writeFileSync(path.join(OUTPUT_DIR, resumePdfName), resumePdfBuffer);

      let clFilename = null;
      let clPdfName = null;
      if (coverLetter) {
        const coverLetterBuffer = await buildDocx(coverLetter, `Cover Letter - ${company} (${eng})`);
        fs.writeFileSync(path.join(OUTPUT_DIR, coverLetterFilename), coverLetterBuffer);
        clFilename = coverLetterFilename;

        const coverLetterPdfBuffer = await buildPdf(coverLetter, `Cover Letter - ${company} (${eng})`);
        fs.writeFileSync(path.join(OUTPUT_DIR, coverLetterPdfName), coverLetterPdfBuffer);
        clPdfName = coverLetterPdfName;
      }

      return {
        engine: eng,
        data: {
          resume,
          coverLetter,
          resumeFilename,
          resumePdfName,
          coverLetterFilename: clFilename,
          coverLetterPdfName: clPdfName
        }
      };
    }));

    settlements.forEach((s, i) => {
      const eng = engines[i];
      if (s.status === 'fulfilled') {
        results[s.value.engine] = s.value.data;
      } else {
        console.error(`Error with engine ${eng}:`, s.reason.message);
        results[eng] = { error: s.reason.message };
      }
    });

    res.json({ results });
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
    const pdfName = `${typeLabel}_refined_${timestamp}.pdf`;

    const buffer = await buildDocx(refined, type === 'resume' ? 'Resume (Refined)' : 'Cover Letter (Refined)');
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);

    const pdfBuffer = await buildPdf(refined, type === 'resume' ? 'Resume (Refined)' : 'Cover Letter (Refined)');
    fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBuffer);

    res.json({
      markdown: refined,
      filename,
      pdfName
    });
  } catch (err) {
    console.error('Refine error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/download/:filename — download file
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  } else if (ext === '.docx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Resume Tailor running at http://localhost:${PORT}`);
});
