import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, MAX_SPEED, MIN_SPEED, SERVER_DOWN, loadSettings, saveSettings, serverUrl, type Settings } from "../lib/settings";

type Health = { state: "checking" } | { state: "ok"; device: string } | { state: "down" };

async function checkHealth(port: number): Promise<Health> {
  try {
    const res = await fetch(`${serverUrl(port)}/health`, { signal: AbortSignal.timeout(3000) });
    const body = await res.json();
    return body.ok ? { state: "ok", device: body.device } : { state: "down" };
  } catch {
    return { state: "down" };
  }
}

export function Popup() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [health, setHealth] = useState<Health>({ state: "checking" });

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    setHealth({ state: "checking" });
    checkHealth(settings.port).then(setHealth);
  }, [settings.port]);

  const update = (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    saveSettings(patch);
  };

  return (
    <div className="popup">
      <header>
        <h1>EMA Reader</h1>
        <span className="tag" title="Okunan ses yapay zekâ ile üretilir">AI sesi</span>
      </header>

      <div className="status">
        <span className={`dot ${health.state === "ok" ? "ok" : health.state === "down" ? "down" : ""}`} />
        {health.state === "checking" && "Sunucu kontrol ediliyor…"}
        {health.state === "ok" && `Sunucu çalışıyor (${health.device === "cuda" ? "GPU" : "CPU"})`}
        {health.state === "down" && "Sunucu kapalı"}
      </div>
      {health.state === "down" && <p className="error">{SERVER_DOWN}</p>}

      <label>
        Hız
        <span className="speed">
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.25}
            value={settings.speed}
            onChange={(e) => update({ speed: Number(e.target.value) })}
          />
          <output>{settings.speed.toLocaleString("tr")}x</output>
        </span>
      </label>
      <label>
        Seçince ▶ balonu göster
        <input type="checkbox" checked={settings.bubble} onChange={(e) => update({ bubble: e.target.checked })} />
      </label>
      <label>
        Okunan kelimeyi vurgula
        <input type="checkbox" checked={settings.highlight} onChange={(e) => update({ highlight: e.target.checked })} />
      </label>
      <label>
        Sunucu portu
        <input
          type="number"
          min={1}
          max={65535}
          value={settings.port}
          onChange={(e) => {
            const port = Number(e.target.value);
            if (Number.isInteger(port) && port > 0 && port < 65536) update({ port });
          }}
        />
      </label>
      <p className="note">
        <kbd>Alt</kbd>+<kbd>S</kbd> seçili metni okur, okuma sürerken durdurur. Kısayolu chrome://extensions/shortcuts
        sayfasından değiştirebilirsin.
      </p>
      <p className="note">Metin bilgisayarından çıkmaz; ses yerel EMA Lightning sunucusunda üretilir.</p>
    </div>
  );
}
