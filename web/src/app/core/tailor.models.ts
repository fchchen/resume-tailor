export type AiEngine = 'claude' | 'gemini' | 'codex';

export interface TailorRequest {
  jobTitle: string;
  company: string;
  jobDescription: string;
  jobUrl: string;
  engine: AiEngine[];
  baseResume: string;
  baseCoverLetter: string;
}

export interface EngineResult {
  resume?: string;
  coverLetter?: string;
  resumeFilename?: string;
  resumePdfName?: string;
  coverLetterFilename?: string;
  coverLetterPdfName?: string;
  error?: string;
}

export interface TailorResponse {
  results: Record<string, EngineResult>;
  company: string;
}

export interface ScrapeResponse {
  description?: string;
  company?: string;
}

export interface DataFilesResponse {
  files: string[];
}

export interface RefineRequest {
  currentMarkdown: string;
  feedback: string;
  type: 'resume' | 'coverLetter';
  engine: string;
}

export interface RefineResponse {
  markdown: string;
  filename: string;
  pdfName: string;
}
