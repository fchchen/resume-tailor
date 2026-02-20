const form = document.getElementById('tailor-form');
const generateBtn = document.getElementById('generate-btn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');

const baseResumeSelect = document.getElementById('baseResume');
const baseCoverLetterSelect = document.getElementById('baseCoverLetter');

const jobUrlInput = document.getElementById('jobUrl');
const companyInput = document.getElementById('company');
const jdTextarea = document.getElementById('jobDescription');

// Auto-fetch JD and Company when URL is pasted
jobUrlInput.addEventListener('change', async () => {
  const url = jobUrlInput.value.trim();
  if (!url) return;

  hideError();
  const originalLabel = jobUrlInput.previousElementSibling.textContent;
  jobUrlInput.previousElementSibling.textContent = 'Job URL (Fetching...)';

  try {
    const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.description) jdTextarea.value = data.description;
    if (data.company) {
      companyInput.value = data.company;
    } else {
      showError('Could not find company name from URL. Please enter it manually.');
    }
  } catch (err) {
    console.error('Fetch error:', err);
    showError('Could not auto-fetch from URL. Please enter JD and Company manually.');
  } finally {
    jobUrlInput.previousElementSibling.textContent = originalLabel;
  }
});

// Current state (map of engine -> data)
let engineResults = {};

// Load data files on startup
async function loadDataFiles() {
  try {
    const res = await fetch('/api/data-files');
    const { files } = await res.json();
    
    files.forEach(file => {
      const opt1 = document.createElement('option');
      opt1.value = file;
      opt1.textContent = file;
      baseResumeSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = file;
      opt2.textContent = file;
      baseCoverLetterSelect.appendChild(opt2);
    });

    // Set defaults
    if (files.includes('resume.md')) baseResumeSelect.value = 'resume.md';
    if (files.includes('cover-letter.md')) baseCoverLetterSelect.value = 'cover-letter.md';
  } catch (err) {
    console.error('Failed to load data files:', err);
  }
}

loadDataFiles();

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const jobTitle = document.getElementById('jobTitle').value.trim();
  const company = document.getElementById('company').value.trim();
  const jobDescription = document.getElementById('jobDescription').value.trim();
  const jobUrl = document.getElementById('jobUrl').value.trim();
  const baseResume = baseResumeSelect.value;
  const baseCoverLetter = baseCoverLetterSelect.value;

  const engines = Array.from(document.querySelectorAll('input[name="engine"]:checked')).map(cb => cb.value);

  // Validation: Job Title and (JD or URL) are strictly required.
  if (!jobTitle || (!jobDescription && !jobUrl)) {
    showError('Please provide a Job Title and either a Job Description or a Job URL.');
    return;
  }

  if (engines.length === 0) {
    showError('Please select at least one AI engine.');
    return;
  }

  showLoading(true);
  hideError();
  resultsEl.classList.add('hidden');
  resultsEl.innerHTML = '';

  try {
    const res = await fetch('/api/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jobTitle, 
        company, 
        jobDescription, 
        jobUrl, 
        engine: engines,
        baseResume,
        baseCoverLetter
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');

    engineResults = data.results;
    if (data.company) companyInput.value = data.company;
    showAllResults(engineResults);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
});

function showAllResults(results) {
  resultsEl.innerHTML = '';
  
  for (const [engine, data] of Object.entries(results)) {
    const engineDiv = document.createElement('div');
    engineDiv.className = 'engine-result';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'engine-title';
    titleEl.textContent = engine;
    engineDiv.appendChild(titleEl);

    if (data.error) {
      const errEl = document.createElement('p');
      errEl.className = 'error';
      errEl.textContent = `Error: ${data.error}`;
      engineDiv.appendChild(errEl);
    } else {
      const grid = document.createElement('div');
      grid.className = 'results-grid';

      // Resume Panel
      const resumePanel = createPanel('Tailored Resume', data.resume, [
        { label: 'DOCX', href: `/api/download/${data.resumeFilename}` },
        { label: 'PDF', href: `/api/download/${data.resumePdfName}`, className: 'pdf-btn' }
      ], (feedback) => refine(engine, 'resume', feedback));
      
      // Cover Letter Panel
      const clPanel = createPanel('Cover Letter', data.coverLetter || '(No cover letter generated)', 
        data.coverLetterFilename ? [
          { label: 'DOCX', href: `/api/download/${data.coverLetterFilename}` },
          { label: 'PDF', href: `/api/download/${data.coverLetterPdfName}`, className: 'pdf-btn' }
        ] : [], 
        (feedback) => refine(engine, 'coverLetter', feedback)
      );

      grid.appendChild(resumePanel);
      grid.appendChild(clPanel);
      engineDiv.appendChild(grid);
    }
    resultsEl.appendChild(engineDiv);
  }

  resultsEl.classList.remove('hidden');
}

function createPanel(title, content, downloads, refineFn) {
  const panel = document.createElement('div');
  panel.className = 'result-panel';

  const header = document.createElement('div');
  header.className = 'panel-header';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  header.appendChild(h2);

  const dlGroup = document.createElement('div');
  dlGroup.className = 'download-group';
  downloads.forEach(dl => {
    const a = document.createElement('a');
    a.href = dl.href;
    a.className = `download-btn ${dl.className || ''}`;
    a.textContent = dl.label;
    dlGroup.appendChild(a);
  });
  header.appendChild(dlGroup);
  panel.appendChild(header);

  const preview = document.createElement('div');
  preview.className = 'preview';
  preview.textContent = content;
  panel.appendChild(preview);

  const refineSection = document.createElement('div');
  refineSection.className = 'refine-section';
  const textarea = document.createElement('textarea');
  textarea.rows = 2;
  textarea.placeholder = 'Feedback...';
  const btn = document.createElement('button');
  btn.className = 'refine-btn';
  btn.textContent = 'Refine';
  btn.onclick = () => refineFn(textarea.value.trim());
  
  refineSection.appendChild(textarea);
  refineSection.appendChild(btn);
  panel.appendChild(refineSection);

  return panel;
}

async function refine(engine, type, feedback) {
  if (!feedback) return;

  const currentMarkdown = type === 'resume' ? engineResults[engine].resume : engineResults[engine].coverLetter;
  
  // Find the button that was clicked
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentMarkdown, feedback, type, engine })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Refinement failed');

    if (type === 'resume') {
      engineResults[engine].resume = data.markdown;
      engineResults[engine].resumeFilename = data.filename;
      engineResults[engine].resumePdfName = data.pdfName;
    } else {
      engineResults[engine].coverLetter = data.markdown;
      engineResults[engine].coverLetterFilename = data.filename;
      engineResults[engine].coverLetterPdfName = data.pdfName;
    }
    
    showAllResults(engineResults);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function showLoading(show) {
  if (show) {
    loadingEl.classList.remove('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  } else {
    loadingEl.classList.add('hidden');
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate';
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}
