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

  protected readonly canStart = computed(() => {
    const collection = this.selectedCollection();
    const pairs = this.selectedPairs();
    return !!collection && collection.image_count >= 2 && !!pairs;
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
    this.selectedCollection.set(collection);
    if (collection.image_count < 2) {
      this.selectedPairs.set(null);
      return;
    }
    const currentPairs = this.selectedPairs() ?? 2;
    const pairs = this.clampPairs(currentPairs, collection.image_count);
    this.selectedPairs.set(pairs);
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

    const pairs = this.clampPairs(numericValue, collection.image_count);
    this.selectedPairs.set(pairs);
  }

  protected increasePairs(step: number): void {
    const collection = this.selectedCollection();
    if (!collection) {
      return;
    }

    const current = this.selectedPairs() ?? 2;
    const pairs = this.clampPairs(current + step, collection.image_count);
    this.selectedPairs.set(pairs);
  }

  protected startGame(): void {
    const collection = this.selectedCollection();
    const pairs = this.selectedPairs();

    if (!collection || !pairs) {
      return;
    }

    this.router.navigate(['/play', collection.id], {
      queryParams: { pairs }
    });
  }

  protected trackByCollectionId(_: number, collection: CollectionSummary): string {
    return collection.id;
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
              payload.find((item) => item.image_count >= 2) ?? payload[0];
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
}
