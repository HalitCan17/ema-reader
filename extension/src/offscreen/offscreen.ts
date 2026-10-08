// Sunucudan sesi alıp Web Audio ile çalar. Offscreen belgesi eklentinin kendi
// kaynağında çalıştığı için HTTPS sayfalardaki localhost kısıtlamalarına takılmaz.
import type { OffscreenRead, Progress, ProgressEnvelope } from "../lib/messages";
import { SERVER_DOWN, serverUrl } from "../lib/settings";

let ctx: AudioContext | null = null;
let generation = 0;
let source: AudioBufferSourceNode | null = null;

function report(tabId: number, progress: Progress) {
  const msg: ProgressEnvelope = { target: "background", tabId, progress };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function synthesize(port: number, text: string): Promise<AudioBuffer> {
  let res: Response;
  try {
    res = await fetch(`${serverUrl(port)}/say`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error(SERVER_DOWN);
  }
  if (!res.ok) {
    const detail = await res.json().then((j) => j.detail, () => res.statusText);
    throw new Error(`EMA sunucusu hata verdi: ${detail}`);
  }
  return ctx!.decodeAudioData(await res.arrayBuffer());
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

/** Yeni bir okuma öncekini keser. */
function cancelCurrent() {
  generation++;
  if (source) {
    try {
      source.stop();
    } catch {
      /* zaten bitmiş */
    }
    source = null;
  }
}

async function read({ readId, tabId, port, sentences }: OffscreenRead) {
  cancelCurrent();
  const gen = generation;
  ctx ??= new AudioContext();
  try {
    let next = synthesize(port, sentences[0]);
    for (let i = 0; i < sentences.length; i++) {
      const buffer = await next;
      if (gen !== generation) return;
      // Bu cümle çalarken bir sonrakini şimdiden iste.
      if (i + 1 < sentences.length) {
        next = synthesize(port, sentences[i + 1]);
        next.catch(() => {}); // hata, sırası gelince yukarıda yakalanır
      }
      report(tabId, { type: "sentence-start", readId, index: i, duration: buffer.duration });
      await play(buffer);
      if (gen !== generation) return;
    }
    report(tabId, { type: "done", readId });
  } catch (err) {
    if (gen === generation) report(tabId, { type: "error", readId, message: (err as Error).message });
  }
}

chrome.runtime.onMessage.addListener((msg: OffscreenRead) => {
  if (msg.target === "offscreen" && msg.type === "read") read(msg);
});
