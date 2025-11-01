export interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  images_url: string;
  image_count: number;
  source: string | null;
}

export interface ImageAsset {
  filename: string;
  url: string;
}

export type TileState = 'hidden' | 'visible' | 'matched';

export interface GameTile {
  id: number;
  image: ImageAsset;
  state: TileState;
}
