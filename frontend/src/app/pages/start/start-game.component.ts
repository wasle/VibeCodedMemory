import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CollectionsService } from '../../services/collections.service';
import { GAME_CONFIG } from '../../config/game-config';
import { CollectionSummary } from '../../models/types';

@Component({
  selector: 'app-start-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './start-game.component.html',
  styleUrl: './start-game.component.scss'
})
export class StartGameComponent {
  private readonly collectionsService = inject(CollectionsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly collections = signal<CollectionSummary[]>([]);
  protected readonly selectedCollection = signal<CollectionSummary | null>(null);
  protected readonly selectedPairs = signal<number | null>(null);
  protected readonly selectedColumns = signal<number | null>(null);

  protected readonly canStart = computed(() => {
    const collection = this.selectedCollection();
    const pairs = this.selectedPairs();
    const columns = this.selectedColumns();
    return !!collection && collection.pair_count >= 2 && !!pairs && !!columns;
  });

  protected readonly totalTiles = computed(() => {
    const pairs = this.selectedPairs();
    return pairs ? pairs * 2 : 0;
  });

  protected readonly calculatedRows = computed(() => {
    const tiles = this.totalTiles();
    const columns = this.selectedColumns();
    if (!columns || columns <= 0 || tiles <= 0) {
      return 0;
    }
    return Math.ceil(tiles / columns);
  });

  protected readonly previewTiles = computed(() => {
    const total = this.totalTiles();
    if (!total) {
      return [];
    }
    return Array.from({ length: total }, (_, index) => index);
  });

  constructor() {
    this.loadCollections();
  }

  protected retry(): void {
    if (this.loading()) {
      return;
    }
    this.loadCollections();
  }

  protected selectCollection(collection: CollectionSummary): void {
    const previousSelection = this.selectedCollection();
    this.selectedCollection.set(collection);
    if (collection.pair_count < 2) {
      this.selectedPairs.set(null);
      this.selectedColumns.set(null);
      return;
    }
    const currentPairs =
      previousSelection?.id === collection.id && this.selectedPairs() !== null
        ? this.selectedPairs()!
        : this.defaultPairs(collection.pair_count);
    const pairs = this.clampPairs(currentPairs, collection.pair_count);
    this.selectedPairs.set(pairs);
    if (!previousSelection || previousSelection.id !== collection.id) {
      this.selectedColumns.set(null);
    }
    this.ensureColumnsAreValid(pairs);
  }

  protected onPairsChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return;
    }
    const rawValue = target.value;
    const collection = this.selectedCollection();
    if (!collection) {
      return;
    }

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      return;
    }

    const pairs = this.clampPairs(numericValue, collection.pair_count);
    this.selectedPairs.set(pairs);
    this.ensureColumnsAreValid(pairs);
  }

  protected increasePairs(step: number): void {
    const collection = this.selectedCollection();
    if (!collection) {
      return;
    }

    const current = this.selectedPairs() ?? 2;
    const pairs = this.clampPairs(current + step, collection.pair_count);
    this.selectedPairs.set(pairs);
    this.ensureColumnsAreValid(pairs);
  }

  protected onColumnsChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return;
    }
    const collection = this.selectedCollection();
    const pairs = this.selectedPairs();
    if (!collection || !pairs) {
      return;
    }

    const rawValue = target.value;
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      return;
    }

    const columns = this.clampColumns(numericValue, pairs);
    this.selectedColumns.set(columns);
  }

  protected increaseColumns(step: number): void {
    const pairs = this.selectedPairs();
    if (!pairs) {
      return;
    }
    const current = this.selectedColumns() ?? this.defaultColumns(pairs);
    const columns = this.clampColumns(current + step, pairs);
    this.selectedColumns.set(columns);
  }

  protected startGame(): void {
    const collection = this.selectedCollection();
    const pairs = this.selectedPairs();
    const columns = this.selectedColumns();

    if (!collection || !pairs || !columns) {
      return;
    }

    this.router.navigate(['/play', collection.id], {
      queryParams: { pairs, columns }
    });
  }

  protected trackByCollectionId(_: number, collection: CollectionSummary): string {
    return collection.id;
  }

  protected trackByPreviewIndex(_: number, index: number): number {
    return index;
  }

  private loadCollections(): void {
    this.loading.set(true);
    this.error.set(null);

    this.collectionsService
      .listCollections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.collections.set(payload);
          this.loading.set(false);
          if (payload.length > 0 && !this.selectedCollection()) {
            const firstPlayable =
              payload.find((item) => item.pair_count >= 2) ?? payload[0];
            this.selectCollection(firstPlayable);
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('We could not load collections. Please try again.');
        }
      });
  }

  private clampPairs(value: number, maxPairs: number): number {
    const safeMax = Math.max(2, Math.floor(maxPairs));
    const safeValue = Math.floor(value);
    return Math.min(Math.max(safeValue, 2), safeMax);
  }

  private defaultPairs(maxPairs: number): number {
    const playableMax = Math.max(2, Math.floor(maxPairs));
    return Math.min(16, playableMax);
  }

  private clampColumns(value: number, pairs: number): number {
    const totalTiles = Math.max(2, pairs * 2);
    const minColumns = 2;
    const safeValue = Math.floor(value);
    const maxColumns = Math.max(minColumns, totalTiles);
    return Math.min(Math.max(safeValue, minColumns), maxColumns);
  }

  private defaultColumns(pairs: number): number {
    return this.clampColumns(GAME_CONFIG.defaultTileColumns, pairs);
  }

  private ensureColumnsAreValid(pairs: number): void {
    const current = this.selectedColumns();
    const next = this.clampColumns(current ?? this.defaultColumns(pairs), pairs);
    this.selectedColumns.set(next);
  }
}
