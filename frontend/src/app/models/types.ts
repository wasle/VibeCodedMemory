export interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  pairs_url: string;
  image_count: number;
  pair_count: number;
  source: string | null;
}

export type CardFace = ImageCard | MarkdownCard;

export interface ImageCard {
  kind: 'image';
  filename: string;
  url: string;
}

export interface MarkdownCard {
  kind: 'markdown';
  content: string;
}

export interface CardPair {
  cards: [CardFace, CardFace];
}

export type TileState = 'hidden' | 'visible' | 'matched';

export interface GameTile {
  id: number;
  card: CardFace;
  matchKey: string;
  state: TileState;
}
