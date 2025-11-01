export interface GameConfig {
  apiServerUrl: string;
  defaultTileColumns: number;
}

export const GAME_CONFIG: GameConfig = {
  apiServerUrl: 'http://localhost:8000',
  defaultTileColumns: 6
};
