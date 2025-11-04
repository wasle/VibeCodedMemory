import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
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
  private _tile!: GameTile;
  protected cardKind: string | null = null;
  protected markdownContent: string | null = null;
  protected imageUrl: string | null = null;
  protected imageAlt: string | null = null;

  @Input({ required: true })
  set tile(value: GameTile) {
    this._tile = value;
    this.cardKind = this.resolveKind(value.card);
    this.imageUrl = null;
    this.imageAlt = null;
    this.markdownContent = null;
    if (this.cardKind === 'markdown') {
      const raw = (value.card as { content: string }).content ?? '';
      const rendered = this.renderMarkdown(raw);
      this.markdownContent = rendered && rendered.trim().length > 0 ? rendered : this.escapeHtml(raw);
    }
    if (this.cardKind === 'image') {
      const imageCard = value.card as { url: string; filename?: string };
      this.imageUrl = imageCard.url;
      this.imageAlt = imageCard.filename ?? 'Collection card';
    }
  }

  get tile(): GameTile {
    return this._tile;
  }

  @Output() tileSelected = new EventEmitter<number>();

  protected get isRevealed(): boolean {
    return this._tile.state === 'visible' || this._tile.state === 'matched';
  }

  protected handleSelect(): void {
    if (!this._tile || this._tile.state === 'matched') {
      return;
    }

    this.tileSelected.emit(this._tile.id);
  }

  private renderMarkdown(source: string): string {
    return this.transformMarkdown(source);
  }

  private resolveKind(card: unknown): string | null {
    if (!card || typeof card !== 'object') {
      return null;
    }
    const rawKind = (card as { kind?: string }).kind;
    if (typeof rawKind === 'string' && rawKind.trim().length > 0) {
      return rawKind.trim().toLowerCase();
    }
    if (this.isImageCard(card)) {
      return 'image';
    }
    if (this.isMarkdownCard(card)) {
      return 'markdown';
    }
    return null;
  }

  private isImageCard(card: unknown): card is { url: string } {
    return (
      !!card &&
      typeof card === 'object' &&
      typeof (card as { url?: unknown }).url === 'string'
    );
  }

  private isMarkdownCard(card: unknown): card is { content: string } {
    return (
      !!card &&
      typeof card === 'object' &&
      typeof (card as { content?: unknown }).content === 'string'
    );
  }

  private transformMarkdown(source: string): string {
    const normalized = source.replace(/\r\n/g, '\n');
    const placeholders: string[] = [];
    const codeFencePattern = /```([\w#+-]*)\n([\s\S]*?)```/g;

    let working = normalized.replace(codeFencePattern, (_, lang: string, code: string) => {
      const safeLang = this.normalizeLanguage(lang);
      const escapedCode = this.escapeHtml(code.replace(/\n+$/, ''));
      const codeHtml = `<pre><code${safeLang ? ` class="language-${safeLang}"` : ''}>${escapedCode}</code></pre>`;
      const placeholder = `__CODE_BLOCK_${placeholders.length}__`;
      placeholders.push(codeHtml);
      return placeholder;
    });

    working = this.escapeHtml(working);
    working = working.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    working = working.replace(/`([^`]+)`/g, '<code>$1</code>');
    working = working.replace(/\n/g, '<br />');

    return working.replace(/__CODE_BLOCK_(\d+)__/g, (_, index: string) => placeholders[Number(index)] ?? '');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizeLanguage(value: string): string {
    const trimmed = value?.trim().toLowerCase() ?? '';
    return trimmed.replace(/[^a-z0-9+#-]/g, '');
  }
}
