export interface Settings {
  bubble: boolean;
  highlight: boolean;
  port: number;
}

export const DEFAULT_SETTINGS: Settings = { bubble: true, highlight: true, port: 8765 };

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get({ ...DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.sync.set(patch);
}

export const serverUrl = (port: number) => `http://127.0.0.1:${port}`;

export const SERVER_DOWN = "EMA sunucusu çalışmıyor, README'deki adımlarla başlat.";
