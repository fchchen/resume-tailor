import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TailorApiService } from './tailor-api.service';
import { TailorRequest } from './tailor.models';

describe('TailorApiService', () => {
  let service: TailorApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TailorApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch data files', () => {
    const mockResponse = { files: ['resume.md', 'cover-letter.md'] };

    service.getDataFiles().subscribe(result => {
      expect(result).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne('/api/data-files');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should scrape a URL', () => {
    const mockResponse = { description: 'Job desc', company: 'Acme' };

    service.scrapeUrl('https://example.com/job').subscribe(result => {
      expect(result).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(r => r.url === '/api/scrape');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('url')).toBe('https://example.com/job');
    req.flush(mockResponse);
  });

  it('should post tailor request', () => {
    const request: TailorRequest = {
      jobTitle: 'Engineer',
      company: 'Acme',
      jobDescription: 'Build things',
      jobUrl: '',
      engine: ['claude'],
      baseResume: 'resume.md',
      baseCoverLetter: 'cover-letter.md'
    };
    const mockResponse = {
      results: { claude: { resume: '# Resume', coverLetter: '# CL' } },
      company: 'Acme'
    };

    service.tailor(request).subscribe(result => {
      expect(result).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne('/api/tailor');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(mockResponse);
  });

  it('should post refine request', () => {
    const request = {
      currentMarkdown: '# Resume',
      feedback: 'More detail',
      type: 'resume' as const,
      engine: 'claude'
    };
    const mockResponse = { markdown: '# Better Resume', filename: 'resume.docx', pdfName: 'resume.pdf' };

    service.refine(request).subscribe(result => {
      expect(result).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne('/api/refine');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should generate download URL', () => {
    expect(service.downloadUrl('test.docx')).toBe('/api/download/test.docx');
  });
});
