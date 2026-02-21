import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url.token';
import {
  DataFilesResponse,
  RefineRequest,
  RefineResponse,
  ScrapeResponse,
  TailorRequest,
  TailorResponse
} from './tailor.models';

@Injectable({ providedIn: 'root' })
export class TailorApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getDataFiles(): Observable<DataFilesResponse> {
    return this.http.get<DataFilesResponse>(`${this.baseUrl}/data-files`);
  }

  scrapeUrl(url: string): Observable<ScrapeResponse> {
    const params = new HttpParams().set('url', url);
    return this.http.get<ScrapeResponse>(`${this.baseUrl}/scrape`, { params });
  }

  tailor(request: TailorRequest): Observable<TailorResponse> {
    return this.http.post<TailorResponse>(`${this.baseUrl}/tailor`, request);
  }

  refine(request: RefineRequest): Observable<RefineResponse> {
    return this.http.post<RefineResponse>(`${this.baseUrl}/refine`, request);
  }

  downloadUrl(filename: string): string {
    return `${this.baseUrl}/download/${filename}`;
  }
}
