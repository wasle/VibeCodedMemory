import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CollectionsService } from '../../services/collections.service';
import { GAME_CONFIG } from '../../config/game-config';
import { GameTile, ImageAsset, TileState } from '../../models/types';
import { GameTileComponent } from './game-tile.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule, GameTileComponent],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss'
})
export class GameBoardComponent implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly collectionsService = inject(CollectionsService);
  private readonly destroyRef = inject(DestroyRef);

  private tileIdCounter = 0;
  private pendingHideTimeout: number | null = null;
  private revealedTileIds: number[] = [];

  @ViewChild('boardContainer') private boardElement?: ElementRef<HTMLDivElement>;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tiles = signal<GameTile[]>([]);
  protected readonly attempts = signal(0);
  protected readonly collectionTitle = signal<string>('');
  protected readonly columns = signal<number>(GAME_CONFIG.defaultTileColumns);
  protected readonly pairsToFind = signal<number>(0);
  protected readonly boardStyle = signal<Record<string, string>>({
    gap: '16px'
  });
  protected readonly elapsedSeconds = signal(0);

  private readonly baseGapPx = 16;
  private readonly minGapPx = 8;
  private readonly maxGapPx = 24;
  private readonly minTileSizePx = 32;
  private timerInterval: number | null = null;
  private gameStartedAt: number | null = null;
  private accumulatedSeconds = 0;

  protected readonly matchedPairs = computed(
    () => this.tiles().filter((tile) => tile.state === 'matched').length / 2
  );

  protected readonly allPairsFound = computed(
    () => this.tiles().length > 0 && this.tiles().every((tile) => tile.state === 'matched')
  );

  protected readonly rows = computed(() => {
    const columnCount = this.columns();
    const tileCount = this.tiles().length;
    if (!columnCount || columnCount <= 0 || tileCount === 0) {
      return 0;
    }
    return Math.ceil(tileCount / columnCount);
  });

  protected readonly formattedElapsedTime = computed(() => this.formatElapsed(this.elapsedSeconds()));

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearPendingState();
      this.stopTimer();
    });

    effect(() => {
      const columnCount = this.columns();
      const rowCount = this.rows();

      if (!columnCount || !rowCount) {
        return;
      }

      this.scheduleBoardLayout();
    });

    effect(() => {
      if (this.allPairsFound()) {
        this.stopTimer();
      }
    });

    const collectionId = this.route.snapshot.paramMap.get('collectionId');
    const pairsParam = this.parsePositiveInt(this.route.snapshot.queryParamMap.get('pairs'));
    const columnsParam = this.parsePositiveInt(this.route.snapshot.queryParamMap.get('columns'));

    if (!collectionId || pairsParam === null || pairsParam < 2) {
      void this.router.navigate(['/']);
      return;
    }

    this.loadCollection(collectionId, pairsParam, columnsParam);
  }

  ngAfterViewInit(): void {
    this.scheduleBoardLayout();
  }

  @HostListener('window:resize')
  protected handleWindowResize(): void {
    this.scheduleBoardLayout();
  }

  protected startNewGame(): void {
    this.stopTimer();
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

    this.startTimer();

    this.setTileState(tileId, 'visible');
    this.revealedTileIds.push(tileId);

    if (this.revealedTileIds.length === 2) {
      this.attempts.update((value) => value + 1);
      this.evaluateRevealedTiles();
    }
  }

  private startTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.timerInterval !== null) {
      return;
    }

    if (this.gameStartedAt === null) {
      this.gameStartedAt = Date.now();
    }

    this.elapsedSeconds.set(this.accumulatedSeconds);

    this.timerInterval = window.setInterval(() => {
      if (this.gameStartedAt === null) {
        return;
      }
      const elapsed = Math.floor((Date.now() - this.gameStartedAt) / 1000) + this.accumulatedSeconds;
      this.elapsedSeconds.set(elapsed);
    }, 1000);
  }

  private stopTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.gameStartedAt !== null) {
      const elapsed = Math.floor((Date.now() - this.gameStartedAt) / 1000);
      this.accumulatedSeconds += elapsed;
      this.elapsedSeconds.set(this.accumulatedSeconds);
      this.gameStartedAt = null;
    }
  }

  private resetTimer(): void {
    this.stopTimer();
    this.accumulatedSeconds = 0;
    this.elapsedSeconds.set(0);
  }

  private formatElapsed(totalSeconds: number): string {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${this.padNumber(minutes)}:${this.padNumber(seconds)}`;
  }

  private padNumber(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private scheduleBoardLayout(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.requestAnimationFrame(() => {
      this.updateBoardLayout();
    });
  }

  private updateBoardLayout(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const boardEl = this.boardElement?.nativeElement;
    const columns = this.columns();
    const rows = this.rows();

    if (!boardEl || !columns || !rows) {
      return;
    }

    const parent = boardEl.parentElement as HTMLElement | null;
    const availableWidth = parent?.clientWidth ?? boardEl.clientWidth;
    if (!availableWidth) {
      return;
    }

    const gap = this.resolveGap(columns);
    const horizontalGapTotal = gap * Math.max(columns - 1, 0);

    const boardRectTop = boardEl.getBoundingClientRect().top;
    const container = boardEl.closest('.game-container') as HTMLElement | null;
    const paddingBottom = container ? this.getPaddingBottom(container) : 0;
    const availableHeight = window.innerHeight - boardRectTop - paddingBottom;
    const verticalGapTotal = gap * Math.max(rows - 1, 0);

    const widthLimitedSize = (availableWidth - horizontalGapTotal) / columns;

    let tileSize = widthLimitedSize;
    if (availableHeight > 0) {
      const heightLimitedSize = (availableHeight - verticalGapTotal) / rows;
      if (heightLimitedSize > 0) {
        tileSize = Math.min(widthLimitedSize, heightLimitedSize);
      }
    }

    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      tileSize = widthLimitedSize > 0 ? widthLimitedSize : this.minTileSizePx;
    }

    if (widthLimitedSize > 0) {
      tileSize = Math.min(Math.max(tileSize, this.minTileSizePx), widthLimitedSize);
    } else {
      tileSize = Math.max(tileSize, this.minTileSizePx);
    }

    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      return;
    }

    this.boardStyle.set({
      gap: `${gap}px`,
      gridTemplateColumns: `repeat(${columns}, ${tileSize}px)`,
      gridAutoRows: `${tileSize}px`
    });
  }

  private resolveGap(columns: number): number {
    if (!Number.isFinite(columns) || columns <= 0) {
      return this.baseGapPx;
    }
    const scaling = columns >= 10 ? 0.65 : columns >= 8 ? 0.8 : 1;
    const candidate = this.baseGapPx * scaling;
    return Math.max(this.minGapPx, Math.min(this.maxGapPx, Math.round(candidate)));
  }

  private getPaddingBottom(element: HTMLElement): number {
    if (typeof window === 'undefined') {
      return 0;
    }
    const styles = window.getComputedStyle(element);
    const value = styles.paddingBottom;
    if (!value) {
      return 0;
    }
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private loadCollection(
    collectionId: string,
    requestedPairs: number,
    requestedColumns: number | null
  ): void {
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
                this.setupGame(images, requestedPairs, requestedColumns);
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

  private setupGame(
    images: ImageAsset[],
    requestedPairs: number,
    requestedColumns: number | null
  ): void {
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
    const totalTiles = pairs * 2;
    const columns = this.clampColumns(
      requestedColumns ?? GAME_CONFIG.defaultTileColumns,
      totalTiles
    );
    this.columns.set(columns);

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
    this.resetTimer();
    this.scheduleBoardLayout();
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

  private clampColumns(value: number, totalTiles: number): number {
    const minColumns = 2;
    const safeValue = Math.floor(value);
    const safeTotal = Math.max(minColumns, totalTiles);

    if (Number.isNaN(safeValue)) {
      return minColumns;
    }

    return Math.min(Math.max(safeValue, minColumns), safeTotal);
  }

  private parsePositiveInt(raw: string | null): number | null {
    if (raw === null) {
      return null;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    const safe = Math.floor(numeric);
    return safe >= 0 ? safe : null;
  }
}
