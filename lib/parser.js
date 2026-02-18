/**
 * Extracts resume and cover letter from AI response using delimiter markers.
 * Same pattern as career-agent's GeminiLlmService.cs ParseResponse/ExtractSection.
 */

function extractSection(text, startMarker, endMarker) {
  const startIndex = text.indexOf(startMarker);
  if (startIndex < 0) return '';

  const contentStart = startIndex + startMarker.length;
  const endIndex = text.indexOf(endMarker, contentStart);
  if (endIndex < 0) return text.slice(contentStart).trim();

  return text.slice(contentStart, endIndex).trim();
}

function parseResponse(response) {
  const resume = extractSection(response, '---RESUME_START---', '---RESUME_END---');
  const coverLetter = extractSection(response, '---COVER_LETTER_START---', '---COVER_LETTER_END---');

  return {
    resume: resume || response.trim(), // fallback: use entire response as resume
    coverLetter: coverLetter || ''
  };
}

module.exports = { parseResponse, extractSection };
