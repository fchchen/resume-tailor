import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EngineResult, RefineResponse } from '../../core/tailor.models';
import { ResultPanelComponent } from './result-panel.component';

export interface RefinedEvent {
  engine: string;
  type: 'resume' | 'coverLetter';
  result: RefineResponse;
}

@Component({
  selector: 'app-engine-result',
  standalone: true,
  imports: [ResultPanelComponent],
  templateUrl: './engine-result.component.html',
  styleUrl: './engine-result.component.scss'
})
export class EngineResultComponent {
  @Input({ required: true }) engineName = '';
  @Input({ required: true }) result!: EngineResult;

  @Output() refinedResult = new EventEmitter<RefinedEvent>();

  onResumeRefined(response: RefineResponse): void {
    this.refinedResult.emit({ engine: this.engineName, type: 'resume', result: response });
  }

  onCoverLetterRefined(response: RefineResponse): void {
    this.refinedResult.emit({ engine: this.engineName, type: 'coverLetter', result: response });
  }
}
