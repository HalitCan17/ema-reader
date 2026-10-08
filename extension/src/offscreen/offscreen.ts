// Sunucudan sesi alıp Web Audio ile çalar. Offscreen belgesi eklentinin kendi
// kaynağında çalıştığı için HTTPS sayfalardaki localhost kısıtlamalarına takılmaz.
import type { SpokenWord } from "../lib/align";
import type { ControlAction, OffscreenMessage, Progress, ProgressEnvelope } from "../lib/messages";
import { SERVER_DOWN, serverUrl } from "../lib/settings";

let ctx: AudioContext | null = null;
let generation = 0;
let source: AudioBufferSourceNode | null = null;
let speed = 1;
let active: { readId: string; tabId: number } | null = null;

function report(tabId: number, progress: Progress) {
  const msg: ProgressEnvelope = { target: "background", tabId, progress };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

interface Spoken {
  buffer: AudioBuffer;
  words: SpokenWord[];
}

/** Sunucunun X-Words başlığı; eski sunucuda yoksa boş liste (vurgu tahmine düşer). */
function parseWords(header: string | null): SpokenWord[] {
  if (!header) return [];
  try {
    const words = JSON.parse(decodeURIComponent(header));
    return Array.isArray(words) ? words : [];
  } catch {
    return [];
  }
}

async function synthesize(port: number, text: string): Promise<Spoken> {
  let res: Response;
  try {
    res = await fetch(`${serverUrl(port)}/say`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speed }),
    });
  } catch {
    throw new Error(SERVER_DOWN);
  }
  if (!res.ok) {
    const detail = await res.json().then((j) => j.detail, () => res.statusText);
    throw new Error(`EMA sunucusu hata verdi: ${typeof detail === "string" ? detail : res.statusText}`);
  }
  const words = parseWords(res.headers.get("X-Words"));
  return { buffer: await ctx!.decodeAudioData(await res.arrayBuffer()), words };
}

function play(buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    source = ctx!.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx!.destination);
    source.onended = () => resolve();
    source.start();
  });
}

/** Süren okumayı keser; okuyan sekmeye bittiğini bildirir. */
function cancelCurrent() {
  generation++;
  if (active) report(active.tabId, { type: "done", readId: active.readId });
  active = null;
  if (source) {
    try {
      source.stop();
    } catch {
      /* zaten bitmiş */
    }
    source = null;
  }
  // Duraklatılmış bir okuma kesildiyse bağlamı yeniden aç.
  if (ctx?.state === "suspended") ctx.resume();
}

async function read(msg: Extract<OffscreenMessage, { type: "read" }>) {
  const { readId, tabId, port, sentences } = msg;
  cancelCurrent();
  const gen = generation;
  active = { readId, tabId };
  speed = msg.speed;
  ctx ??= new AudioContext();
  try {
    let next = synthesize(port, sentences[0]);
    for (let i = 0; i < sentences.length; i++) {
      const { buffer, words } = await next;
      if (gen !== generation) return;
      // Bu cümle çalarken bir sonrakini şimdiden iste.
      if (i + 1 < sentences.length) {
        next = synthesize(port, sentences[i + 1]);
        next.catch(() => {}); // hata, sırası gelince yukarıda yakalanır
      }
      report(tabId, { type: "sentence-start", readId, index: i, duration: buffer.duration, words });
      await play(buffer);
      if (gen !== generation) return;
    }
    active = null;
    report(tabId, { type: "done", readId });
  } catch (err) {
    if (gen !== generation) return;
    active = null;
    report(tabId, { type: "error", readId, message: (err as Error).message });
  }
}

function control(readId: string, action: ControlAction) {
  if (!active || active.readId !== readId) return;
  // Duraklatma tüm ses bağlamını askıya alır; sıradaki cümle hazır olsa da devam edilene kadar çalmaz.
  if (action === "pause") ctx?.suspend();
  else if (action === "resume") ctx?.resume();
  else cancelCurrent();
}

chrome.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "read") read(msg);
  else if (msg.type === "control") control(msg.readId, msg.action);
  else if (msg.type === "speed") speed = msg.speed;
});
