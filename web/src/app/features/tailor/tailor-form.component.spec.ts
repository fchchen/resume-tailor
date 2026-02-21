import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TailorFormComponent } from './tailor-form.component';

describe('TailorFormComponent', () => {
  let component: TailorFormComponent;
  let fixture: ComponentFixture<TailorFormComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TailorFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(TailorFormComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    httpTesting.expectOne('/api/data-files').flush({ files: [] });
    expect(component).toBeTruthy();
  });

  it('should load data files on init', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/data-files');
    req.flush({ files: ['resume.md', 'cover-letter.md'] });

    expect(component.dataFiles()).toEqual(['resume.md', 'cover-letter.md']);
    expect(component.form.controls.baseResume.value).toBe('resume.md');
    expect(component.form.controls.baseCoverLetter.value).toBe('cover-letter.md');
  });

  it('should require job title and description or URL', () => {
    fixture.detectChanges();
    httpTesting.expectOne('/api/data-files').flush({ files: [] });

    component.form.controls.jobTitle.setValue('');
    component.form.controls.jobDescription.setValue('');
    component.form.controls.jobUrl.setValue('');
    component.submit();

    expect(component.error()).toBeTruthy();
    expect(component.isLoading()).toBe(false);
  });

  it('should require at least one engine', () => {
    fixture.detectChanges();
    httpTesting.expectOne('/api/data-files').flush({ files: [] });

    component.form.controls.jobTitle.setValue('Engineer');
    component.form.controls.jobDescription.setValue('Build things');
    component.form.controls.engines.controls.claude.setValue(false);
    component.form.controls.engines.controls.gemini.setValue(false);
    component.form.controls.engines.controls.codex.setValue(false);
    component.submit();

    expect(component.error()).toContain('engine');
  });
});
