import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { CardPair, CollectionSummary } from '../models/types';
import { GAME_CONFIG } from '../config/game-config';

@Injectable({
  providedIn: 'root'
})
export class CollectionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = GAME_CONFIG.apiServerUrl.replace(/\/$/, '');

  listCollections(): Observable<CollectionSummary[]> {
    return this.http.get<CollectionSummary[]>(`${this.baseUrl}/collections`);
  }

  listCollectionPairs(collectionId: string): Observable<CardPair[]> {
    const safeId = encodeURIComponent(collectionId);
    return this.http.get<CardPair[]>(`${this.baseUrl}/collections/${safeId}/pairs`);
  }
}
