import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CollectionsService } from '../../services/collections.service';
import { GAME_CONFIG } from '../../config/game-config';
import { GameTile, ImageAsset, TileState } from '../../models/types';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss'
})
export class GameBoardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly collectionsService = inject(CollectionsService);
  private readonly destroyRef = inject(DestroyRef);

  private tileIdCounter = 0;
  private pendingHideTimeout: number | null = null;
  private revealedTileIds: number[] = [];

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tiles = signal<GameTile[]>([]);
  protected readonly attempts = signal(0);
  protected readonly collectionTitle = signal<string>('');
  protected readonly columns = GAME_CONFIG.defaultTileColumns;
  protected readonly pairsToFind = signal<number>(0);

  protected readonly matchedPairs = computed(
    () => this.tiles().filter((tile) => tile.state === 'matched').length / 2
  );

  protected readonly allPairsFound = computed(
    () => this.tiles().length > 0 && this.tiles().every((tile) => tile.state === 'matched')
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearPendingState());

    const collectionId = this.route.snapshot.paramMap.get('collectionId');
    const pairsParam = Number(this.route.snapshot.queryParamMap.get('pairs'));

    if (!collectionId || Number.isNaN(pairsParam) || pairsParam < 2) {
      void this.router.navigate(['/']);
      return;
    }

    this.loadCollection(collectionId, pairsParam);
  }

  protected startNewGame(): void {
    this.router.navigate(['/']);
  }

  protected tileTrackBy(_: number, tile: GameTile): number {
    return tile.id;
  }

  protected onTileSelected(tileId: number): void {
    const tiles = this.tiles();
    const tile = tiles.find((item) => item.id === tileId);

    if (!tile || tile.state !== 'hidden' || this.loading()) {
      return;
    }

    if (this.pendingHideTimeout !== null) {
      this.hideMismatchedTiles();
    }

    this.setTileState(tileId, 'visible');
    this.revealedTileIds.push(tileId);

    if (this.revealedTileIds.length === 2) {
      this.attempts.update((value) => value + 1);
      this.evaluateRevealedTiles();
    }
  }

  protected isRevealed(tile: GameTile): boolean {
    return tile.state === 'visible' || tile.state === 'matched';
  }

  private loadCollection(collectionId: string, requestedPairs: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.collectionsService
      .listCollections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (collections) => {
          const collection = collections.find((item) => item.id === collectionId);
          if (!collection) {
            this.error.set('Collection not found.');
            this.loading.set(false);
            void this.router.navigate(['/']);
            return;
          }
          this.collectionTitle.set(collection.title);
          this.collectionsService
            .listCollectionImages(collectionId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (images) => {
                this.setupGame(images, requestedPairs);
              },
              error: () => {
                this.error.set('Unable to load collection images.');
                this.loading.set(false);
              }
            });
        },
        error: () => {
          this.error.set('Unable to load collections.');
          this.loading.set(false);
        }
      });
  }

  private setupGame(images: ImageAsset[], requestedPairs: number): void {
    const availablePairs = images.length;

    if (availablePairs < 2) {
      this.error.set('This collection does not have enough images to play.');
      this.loading.set(false);
      return;
    }

    const pairs = Math.min(requestedPairs, availablePairs);
    this.pairsToFind.set(pairs);

    const selectedImages = this.shuffle(images.slice()).slice(0, pairs);
    this.tileIdCounter = 0;
    const tiles = this.shuffle(
      selectedImages.flatMap((image) => [
        this.createTile(image),
        this.createTile(image)
      ])
    );

    this.clearPendingState();
    this.tiles.set(tiles);
    this.attempts.set(0);
    this.loading.set(false);
  }

  private evaluateRevealedTiles(): void {
    const [firstId, secondId] = this.revealedTileIds;
    const currentTiles = this.tiles();
    const firstTile = currentTiles.find((tile) => tile.id === firstId);
    const secondTile = currentTiles.find((tile) => tile.id === secondId);

    if (!firstTile || !secondTile) {
      this.revealedTileIds = [];
      return;
    }

    if (firstTile.image.filename === secondTile.image.filename) {
      this.setTileState(firstId, 'matched');
      this.setTileState(secondId, 'matched');
      this.revealedTileIds = [];
    } else {
      this.pendingHideTimeout = window.setTimeout(() => {
        this.hideMismatchedTiles();
      }, 5000);
    }
  }

  private hideMismatchedTiles(): void {
    const ids = [...this.revealedTileIds];
    this.clearPendingTimeout();

    if (ids.length === 0) {
      return;
    }

    this.tiles.update((tileList) =>
      tileList.map((tile) =>
        ids.includes(tile.id) && tile.state === 'visible'
          ? { ...tile, state: 'hidden' }
          : tile
      )
    );

    this.revealedTileIds = [];
  }

  private setTileState(tileId: number, state: TileState): void {
    this.tiles.update((tileList) =>
      tileList.map((tile) =>
        tile.id === tileId
          ? { ...tile, state }
          : tile
      )
    );
  }

  private createTile(image: ImageAsset): GameTile {
    this.tileIdCounter += 1;
    return {
      id: this.tileIdCounter,
      image,
      state: 'hidden'
    };
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  private clearPendingTimeout(): void {
    if (this.pendingHideTimeout !== null) {
      window.clearTimeout(this.pendingHideTimeout);
      this.pendingHideTimeout = null;
    }
  }

  private clearPendingState(): void {
    this.clearPendingTimeout();
    this.revealedTileIds = [];
  }
}
