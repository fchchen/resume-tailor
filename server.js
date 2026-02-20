const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { callAI } = require('./lib/ai');
const { fetchPublicRepos, formatReposForPrompt } = require('./lib/github');
const { buildTailorPrompt, buildRefinePrompt, buildCompanyExtractionPrompt } = require('./lib/prompt');
const { parseResponse, extractSection } = require('./lib/parser');
const { buildDocx } = require('./lib/docx-builder');
const { buildPdf } = require('./lib/pdf-builder');
const { scrapeJD } = require('./lib/scraper');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure output dir exists
if (!fsSync.existsSync(OUTPUT_DIR)) {
  fsSync.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to sanitize filenames
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

// GET /api/data-files — list files in data directory
app.get('/api/data-files', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    res.json({ files: files.filter(f => f.endsWith('.md')) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list data files' });
  }
});

// GET /api/scrape — fetch JD and metadata
app.get('/api/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    console.log(`Scraping URL: ${url}`);
    const data = await scrapeJD(url);
    
    // AI Extraction Fallback for company name
    if (!data.company && data.description) {
      console.log('Using AI to extract company name...');
      const prompt = buildCompanyExtractionPrompt(data.description);
      let aiResponse;
      try {
        // Try codex first, fallback to claude
        aiResponse = await callAI(prompt, 'codex');
      } catch (e) {
        aiResponse = await callAI(prompt, 'claude');
      }
      
      if (aiResponse && aiResponse.trim().toUpperCase() !== 'UNKNOWN') {
        data.company = aiResponse.trim().split('\n')[0].replace(/["']/g, '');
        console.log(`AI identified company: ${data.company}`);
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tailor — generate tailored resume + cover letter
app.post('/api/tailor', async (req, res) => {
  let { jobTitle, company, jobDescription, jobUrl, engine = 'claude', baseResume, baseCoverLetter } = req.body;

  try {
    const [scrapedData, repoData] = await Promise.all([
      jobUrl && !jobDescription ? scrapeJD(jobUrl) : Promise.resolve(null),
      fetchPublicRepos().catch(err => {
        console.error('GitHub fetch failed:', err.message);
        return [];
      })
    ]);

    if (scrapedData) {
      jobDescription = scrapedData.description;
      if (!company && scrapedData.company) company = scrapedData.company;
    }

    const githubRepos = formatReposForPrompt(repoData);

    if (!company && jobDescription) {
      console.log('Using AI to extract company name from JD...');
      try {
        const prompt = buildCompanyExtractionPrompt(jobDescription);
        let aiResponse;
        try {
          aiResponse = await callAI(prompt, 'codex');
        } catch (e) {
          aiResponse = await callAI(prompt, 'claude');
        }
        
        if (aiResponse && aiResponse.trim().toUpperCase() !== 'UNKNOWN') {
          company = aiResponse.trim().split('\n')[0].replace(/["']/g, '');
          console.log(`AI identified company from JD: "${company}"`);
        }
      } catch (err) {
        console.error('AI company extraction failed completely:', err.message);
      }
    }

    if (!company) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    if (!jobTitle || !jobDescription) {
      return res.status(400).json({ error: 'Job Title and Description are required.' });
    }

    const prompt = await buildTailorPrompt({ 
      jobTitle, 
      company, 
      jobDescription, 
      githubRepos,
      baseResumeFile: baseResume,
      baseCoverLetterFile: baseCoverLetter
    });
    
    const engines = Array.isArray(engine) ? engine : [engine];
    const resultsObj = {};

    const settlements = await Promise.allSettled(engines.map(async (eng) => {
      // Security: Sanitize engine name
      const safeEng = sanitizeFilename(eng);
      
      console.log(`Calling ${eng} for ${jobTitle} at ${company}...`);
      const response = await callAI(prompt, eng);
      const { resume, coverLetter } = parseResponse(response);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeCompany = sanitizeFilename(company);
      
      const resumeFilename = `resume_${safeEng}_${safeCompany}_${timestamp}.docx`;
      const resumePdfName = `resume_${safeEng}_${safeCompany}_${timestamp}.pdf`;
      const coverLetterFilename = `cover_letter_${safeEng}_${safeCompany}_${timestamp}.docx`;
      const coverLetterPdfName = `cover_letter_${safeEng}_${safeCompany}_${timestamp}.pdf`;

      const resumeBuffer = await buildDocx(resume, `Resume - ${company} (${eng})`);
      await fs.writeFile(path.join(OUTPUT_DIR, resumeFilename), resumeBuffer);

      const resumePdfBuffer = await buildPdf(resume, `Resume - ${company} (${eng})`);
      await fs.writeFile(path.join(OUTPUT_DIR, resumePdfName), resumePdfBuffer);

      let clFilename = null;
      let clPdfName = null;
      if (coverLetter) {
        const coverLetterBuffer = await buildDocx(coverLetter, `Cover Letter - ${company} (${eng})`);
        await fs.writeFile(path.join(OUTPUT_DIR, coverLetterFilename), coverLetterBuffer);
        clFilename = coverLetterFilename;

        const coverLetterPdfBuffer = await buildPdf(coverLetter, `Cover Letter - ${company} (${eng})`);
        await fs.writeFile(path.join(OUTPUT_DIR, coverLetterPdfName), coverLetterPdfBuffer);
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
        resultsObj[s.value.engine] = s.value.data;
      } else {
        console.error(`Error with engine ${eng}:`, s.reason.message);
        resultsObj[eng] = { error: s.reason.message };
      }
    });

    res.json({ results: resultsObj, company });
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

  try {
    const prompt = buildRefinePrompt({ currentMarkdown, feedback, type });
    console.log(`Refining ${type} via ${engine}...`);
    const response = await callAI(prompt, engine);

    const startMarker = type === 'resume' ? '---RESUME_START---' : '---COVER_LETTER_START---';
    const endMarker = type === 'resume' ? '---RESUME_END---' : '---COVER_LETTER_END---';
    let refined = extractSection(response, startMarker, endMarker);
    if (!refined) refined = response.trim();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const typeLabel = type === 'resume' ? 'resume' : 'cover_letter';
    const safeEng = sanitizeFilename(engine);
    
    const filename = `${typeLabel}_refined_${safeEng}_${timestamp}.docx`;
    const pdfName = `${typeLabel}_refined_${safeEng}_${timestamp}.pdf`;

    const buffer = await buildDocx(refined, type === 'resume' ? 'Resume (Refined)' : 'Cover Letter (Refined)');
    await fs.writeFile(path.join(OUTPUT_DIR, filename), buffer);

    const pdfBuffer = await buildPdf(refined, type === 'resume' ? 'Resume (Refined)' : 'Cover Letter (Refined)');
    await fs.writeFile(path.join(OUTPUT_DIR, pdfName), pdfBuffer);

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
app.get('/api/download/:filename', async (req, res) => {
  // Security: Prevent path traversal
  const filename = path.basename(req.params.filename);
  const filePath = path.join(OUTPUT_DIR, filename);

  try {
    await fs.access(filePath);
    
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Resume Tailor running at http://localhost:${PORT}`);
});
