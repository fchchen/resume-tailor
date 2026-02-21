import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TailorApiService } from '../../core/tailor-api.service';
import { RefineResponse } from '../../core/tailor.models';

@Component({
  selector: 'app-result-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './result-panel.component.html',
  styleUrl: './result-panel.component.scss'
})
export class ResultPanelComponent {
  private readonly api = inject(TailorApiService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) title = '';
  @Input({ required: true }) markdown = '';
  @Input() docxFilename = '';
  @Input() pdfFilename = '';
  @Input({ required: true }) engine = '';
  @Input({ required: true }) type: 'resume' | 'coverLetter' = 'resume';

  @Output() refined = new EventEmitter<RefineResponse>();

  readonly isRefining = signal(false);
  readonly refineError = signal<string | null>(null);
  feedback = '';

  get docxUrl(): string {
    return this.docxFilename ? this.api.downloadUrl(this.docxFilename) : '';
  }

  get pdfUrl(): string {
    return this.pdfFilename ? this.api.downloadUrl(this.pdfFilename) : '';
  }

  refine(): void {
    if (!this.feedback.trim()) return;

    this.isRefining.set(true);
    this.refineError.set(null);

    this.api.refine({
      currentMarkdown: this.markdown,
      feedback: this.feedback.trim(),
      type: this.type,
      engine: this.engine
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isRefining.set(false);
          this.feedback = '';
          this.refined.emit(result);
        },
        error: (err) => {
          this.isRefining.set(false);
          this.refineError.set(err.error?.error || 'Refinement failed');
        }
      });
  }
}
