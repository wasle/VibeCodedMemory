export interface GameConfig {
  apiServerUrl: string;
  defaultTileColumns: number;
}

interface WindowWithConfig extends Window {
  __APP_CONFIG__?: Partial<GameConfig>;
}

const windowWithConfig: WindowWithConfig | undefined =
  typeof window !== 'undefined'
    ? (window as unknown as WindowWithConfig)
    : typeof globalThis !== 'undefined'
      ? (globalThis as unknown as WindowWithConfig)
      : undefined;

const windowConfig = windowWithConfig?.__APP_CONFIG__ ?? {};

export const GAME_CONFIG: GameConfig = {
  apiServerUrl: windowConfig.apiServerUrl ?? 'http://localhost:8000',
  defaultTileColumns: windowConfig.defaultTileColumns ?? 6
};
