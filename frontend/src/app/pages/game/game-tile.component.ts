import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GameTile } from '../../models/types';

@Component({
  selector: 'app-game-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-tile.component.html',
  styleUrl: './game-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameTileComponent {
  @Input({ required: true }) tile!: GameTile;
  @Output() tileSelected = new EventEmitter<number>();

  protected get isRevealed(): boolean {
    return this.tile.state === 'visible' || this.tile.state === 'matched';
  }

  protected handleSelect(): void {
    if (!this.tile || this.tile.state === 'matched') {
      return;
    }

    this.tileSelected.emit(this.tile.id);
  }
}
