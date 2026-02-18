const form = document.getElementById('tailor-form');
const generateBtn = document.getElementById('generate-btn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');

// Current state
let currentResume = '';
let currentCoverLetter = '';
let currentEngine = 'claude';

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const jobTitle = document.getElementById('jobTitle').value.trim();
  const company = document.getElementById('company').value.trim();
  const jobDescription = document.getElementById('jobDescription').value.trim();
  currentEngine = document.getElementById('engine').value;

  if (!jobTitle || !company || !jobDescription) return;

  showLoading(true);
  hideError();
  resultsEl.classList.add('hidden');

  try {
    const res = await fetch('/api/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle, company, jobDescription, engine: currentEngine })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');

    currentResume = data.resume;
    currentCoverLetter = data.coverLetter;

    showResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
});

// Refine buttons
document.querySelectorAll('.refine-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type = btn.dataset.type;
    const feedbackEl = document.getElementById(`${type}-feedback`);
    const feedback = feedbackEl.value.trim();

    if (!feedback) return;

    const currentMarkdown = type === 'resume' ? currentResume : currentCoverLetter;
    if (!currentMarkdown) return;

    btn.disabled = true;
    btn.textContent = 'Refining...';

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentMarkdown, feedback, type, engine: currentEngine })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed');

      if (type === 'resume') {
        currentResume = data.markdown;
        document.getElementById('resume-preview').textContent = data.markdown;
        document.getElementById('resume-download').href = `/api/download/${data.filename}`;
      } else {
        currentCoverLetter = data.markdown;
        document.getElementById('cover-letter-preview').textContent = data.markdown;
        document.getElementById('cover-letter-download').href = `/api/download/${data.filename}`;
      }

      feedbackEl.value = '';
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = type === 'resume' ? 'Refine Resume' : 'Refine Cover Letter';
    }
  });
});

function showResults(data) {
  document.getElementById('resume-preview').textContent = data.resume;
  document.getElementById('cover-letter-preview').textContent = data.coverLetter || '(No cover letter generated)';

  document.getElementById('resume-download').href = `/api/download/${data.resumeFilename}`;

  const clDownload = document.getElementById('cover-letter-download');
  if (data.coverLetterFilename) {
    clDownload.href = `/api/download/${data.coverLetterFilename}`;
    clDownload.style.display = '';
  } else {
    clDownload.style.display = 'none';
  }

  resultsEl.classList.remove('hidden');
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
