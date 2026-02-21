import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TailorApiService } from '../../core/tailor-api.service';
import { AiEngine, EngineResult } from '../../core/tailor.models';
import { EngineResultComponent, RefinedEvent } from './engine-result.component';

@Component({
  selector: 'app-tailor-form',
  standalone: true,
  imports: [ReactiveFormsModule, EngineResultComponent],
  templateUrl: './tailor-form.component.html',
  styleUrl: './tailor-form.component.scss'
})
export class TailorFormComponent implements OnInit {
  private readonly api = inject(TailorApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly dataFiles = signal<string[]>([]);
  readonly isLoading = signal(false);
  readonly isScraping = signal(false);
  readonly error = signal<string | null>(null);
  readonly engineResults = signal<Record<string, EngineResult>>({});

  get hasResults(): boolean {
    return Object.keys(this.engineResults()).length > 0;
  }

  get engineEntries(): [string, EngineResult][] {
    return Object.entries(this.engineResults());
  }

  readonly form = this.fb.nonNullable.group({
    jobTitle: ['Senior Software Engineer'],
    company: [''],
    baseResume: [''],
    baseCoverLetter: [''],
    engines: this.fb.nonNullable.group({
      claude: [true],
      gemini: [true],
      codex: [false]
    }),
    jobUrl: [''],
    jobDescription: ['']
  });

  ngOnInit(): void {
    this.api.getDataFiles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ files }) => {
          this.dataFiles.set(files);
          if (files.includes('resume.md')) {
            this.form.controls.baseResume.setValue('resume.md');
          }
          if (files.includes('cover-letter.md')) {
            this.form.controls.baseCoverLetter.setValue('cover-letter.md');
          }
        },
        error: () => {
          this.error.set('Failed to load data files');
        }
      });
  }

  onJobUrlBlur(): void {
    const url = this.form.controls.jobUrl.value.trim();
    if (!url) return;

    this.isScraping.set(true);
    this.error.set(null);

    this.api.scrapeUrl(url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.isScraping.set(false);
          if (data.description) {
            this.form.controls.jobDescription.setValue(data.description);
          }
          if (data.company) {
            this.form.controls.company.setValue(data.company);
          } else {
            this.error.set('Could not find company name from URL. Please enter it manually.');
          }
        },
        error: () => {
          this.isScraping.set(false);
          this.error.set('Could not auto-fetch from URL. Please enter JD and Company manually.');
        }
      });
  }

  submit(): void {
    const v = this.form.getRawValue();

    if (!v.jobTitle || (!v.jobDescription && !v.jobUrl)) {
      this.error.set('Please provide a Job Title and either a Job Description or a Job URL.');
      return;
    }

    const engines: AiEngine[] = [];
    if (v.engines.claude) engines.push('claude');
    if (v.engines.gemini) engines.push('gemini');
    if (v.engines.codex) engines.push('codex');

    if (engines.length === 0) {
      this.error.set('Please select at least one AI engine.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.engineResults.set({});

    this.api.tailor({
      jobTitle: v.jobTitle,
      company: v.company,
      jobDescription: v.jobDescription,
      jobUrl: v.jobUrl,
      engine: engines,
      baseResume: v.baseResume,
      baseCoverLetter: v.baseCoverLetter
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.isLoading.set(false);
          this.engineResults.set(data.results);
          if (data.company) {
            this.form.controls.company.setValue(data.company);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.error.set(err.error?.error || 'Generation failed');
        }
      });
  }

  onRefined(event: RefinedEvent): void {
    const current = this.engineResults();
    const engineData = current[event.engine];
    if (!engineData) return;

    const updated = { ...engineData };
    if (event.type === 'resume') {
      updated.resume = event.result.markdown;
      updated.resumeFilename = event.result.filename;
      updated.resumePdfName = event.result.pdfName;
    } else {
      updated.coverLetter = event.result.markdown;
      updated.coverLetterFilename = event.result.filename;
      updated.coverLetterPdfName = event.result.pdfName;
    }

    this.engineResults.set({ ...current, [event.engine]: updated });
  }
}
