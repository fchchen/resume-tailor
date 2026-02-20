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
    
    if (data.error) {
      engineDiv.innerHTML = `
        <h3 class="engine-title">${engine}</h3>
        <p class="error">Error: ${data.error}</p>
      `;
    } else {
      engineDiv.innerHTML = `
        <h3 class="engine-title">${engine}</h3>
        <div class="results-grid">
          <div class="result-panel">
            <div class="panel-header">
              <h2>Tailored Resume</h2>
              <div class="download-group">
                <a href="/api/download/${data.resumeFilename}" class="download-btn">DOCX</a>
                <a href="/api/download/${data.resumePdfName}" class="download-btn pdf-btn">PDF</a>
              </div>
            </div>
            <div class="preview">${data.resume}</div>
            <div class="refine-section">
              <textarea id="refine-resume-${engine}" rows="2" placeholder="Feedback..."></textarea>
              <button class="refine-btn" onclick="refine('${engine}', 'resume')">Refine</button>
            </div>
          </div>

          <div class="result-panel">
            <div class="panel-header">
              <h2>Cover Letter</h2>
              <div class="download-group">
                ${data.coverLetterFilename ? `
                  <a href="/api/download/${data.coverLetterFilename}" class="download-btn">DOCX</a>
                  <a href="/api/download/${data.coverLetterPdfName}" class="download-btn pdf-btn">PDF</a>
                ` : ''}
              </div>
            </div>
            <div class="preview">${data.coverLetter || '(No cover letter generated)'}</div>
            <div class="refine-section">
              <textarea id="refine-cl-${engine}" rows="2" placeholder="Feedback..."></textarea>
              <button class="refine-btn" onclick="refine('${engine}', 'coverLetter')">Refine</button>
            </div>
          </div>
        </div>
      `;
    }
    resultsEl.appendChild(engineDiv);
  }

  resultsEl.classList.remove('hidden');
}

async function refine(engine, type) {
  const feedbackEl = document.getElementById(type === 'resume' ? `refine-resume-${engine}` : `refine-cl-${engine}`);
  const feedback = feedbackEl.value.trim();
  if (!feedback) return;

  const currentMarkdown = type === 'resume' ? engineResults[engine].resume : engineResults[engine].coverLetter;
  
  const btn = event.target;
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

    // Update state and UI
    if (type === 'resume') {
      engineResults[engine].resume = data.markdown;
      engineResults[engine].resumeFilename = data.filename;
      engineResults[engine].resumePdfName = data.pdfName;
    } else {
      engineResults[engine].coverLetter = data.markdown;
      engineResults[engine].coverLetterFilename = data.filename;
      engineResults[engine].coverLetterPdfName = data.pdfName;
    }
    
    // Refresh the view (simplest way)
    showAllResults(engineResults);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refine';
  }
}

// Make refine global so onclick works
window.refine = refine;

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
