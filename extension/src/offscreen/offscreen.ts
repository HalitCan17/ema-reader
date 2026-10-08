// Sunucudan sesi alıp Web Audio ile çalar. Offscreen belgesi eklentinin kendi
// kaynağında çalıştığı için HTTPS sayfalardaki localhost kısıtlamalarına takılmaz.
import type { SpokenWord } from "../lib/align";
import type { ControlAction, OffscreenMessage, Progress, ProgressEnvelope } from "../lib/messages";
import { seekTarget } from "../lib/seek";
import { SERVER_DOWN, serverUrl } from "../lib/settings";

let ctx: AudioContext | null = null;
let generation = 0;
let source: AudioBufferSourceNode | null = null;
let speed = 1;

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

interface Session {
  readId: string;
  tabId: number;
  port: number;
  sentences: string[];
  /** Hazırlanan ya da hazırlanmakta olan sesler; bellek dolmasın diye çalınan yerin etrafında tutulur. */
  cache: Map<number, Promise<Spoken>>;
  /** Bilinen cümle süreleri (sarmada cümle sınırlarını geçmek için). */
  durations: (number | undefined)[];
  index: number;
  /** Çalan cümlenin başlangıcının ses bağlamı saatindeki karşılığı. */
  startedAt: number;
}

const SEEK_SECONDS = 5;
const KEEP_BEHIND = 3; // geri sarma için önbellekte tutulan geçmiş cümle sayısı

let session: Session | null = null;

function get(s: Session, i: number): Promise<Spoken> {
  let p = s.cache.get(i);
  if (!p) {
    p = synthesize(s.port, s.sentences[i]);
    p.then((sp) => (s.durations[i] = sp.buffer.duration)).catch(() => {}); // hata, sırası gelince yakalanır
    s.cache.set(i, p);
  }
  return p;
}

function stopSource() {
  if (!source) return;
  source.onended = null;
  try {
    source.stop();
  } catch {
    /* zaten bitmiş */
  }
  source = null;
}

/** `i` numaralı cümleyi `offset`. saniyesinden çalar; bitince sonrakine geçer. */
async function playSentence(s: Session, i: number, offset: number) {
  const gen = ++generation;
  stopSource();
  s.index = i;
  try {
    const { buffer, words } = await get(s, i);
    if (gen !== generation || session !== s) return;
    // Bu cümle çalarken bir sonrakini şimdiden iste, uzaktakileri bırak.
    if (i + 1 < s.sentences.length) get(s, i + 1);
    for (const k of s.cache.keys()) if (k < i - KEEP_BEHIND || k > i + 1) s.cache.delete(k);

    const src = ctx!.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx!.destination);
    src.onended = () => {
      if (source !== src) return;
      source = null;
      if (i + 1 < s.sentences.length) playSentence(s, i + 1, 0);
      else finish(s);
    };
    source = src;
    s.startedAt = ctx!.currentTime - offset;
    src.start(0, offset);
    report(s.tabId, { type: "sentence-start", readId: s.readId, index: i, offset, duration: buffer.duration, words });
  } catch (err) {
    if (gen !== generation || session !== s) return;
    session = null;
    report(s.tabId, { type: "error", readId: s.readId, message: (err as Error).message });
  }
}

function finish(s: Session) {
  if (session !== s) return;
  session = null;
  report(s.tabId, { type: "done", readId: s.readId });
}

/** Süren okumayı keser; okuyan sekmeye bittiğini bildirir. */
function cancelCurrent() {
  generation++;
  stopSource();
  if (session) finish(session);
  // Duraklatılmış bir okuma kesildiyse bağlamı yeniden aç.
  if (ctx?.state === "suspended") ctx.resume();
}

function read(msg: Extract<OffscreenMessage, { type: "read" }>) {
  cancelCurrent();
  speed = msg.speed;
  ctx ??= new AudioContext();
  const { readId, tabId, port, sentences } = msg;
  session = { readId, tabId, port, sentences, cache: new Map(), durations: [], index: 0, startedAt: 0 };
  playSentence(session, 0, 0);
}

function seek(s: Session, delta: number) {
  // Askıdayken bağlam saati durur, yani duraklatılmış okumada da konum doğru çıkar.
  const pos = source ? ctx!.currentTime - s.startedAt : 0;
  const target = seekTarget(s.index, pos, delta, s.durations, s.sentences.length);
  if (target) playSentence(s, target.index, target.offset);
  else cancelCurrent();
}

function control(readId: string, action: ControlAction, index?: number) {
  const s = session;
  if (!s || s.readId !== readId) return;
  // Duraklatma tüm ses bağlamını askıya alır; sıradaki cümle hazır olsa da devam edilene kadar çalmaz.
  if (action === "pause") ctx?.suspend();
  else if (action === "resume") ctx?.resume();
  else if (action === "back") seek(s, -SEEK_SECONDS);
  else if (action === "forward") seek(s, SEEK_SECONDS);
  else if (action === "jump" && index !== undefined && index >= 0 && index < s.sentences.length) playSentence(s, index, 0);
  else if (action === "stop") cancelCurrent();
}

chrome.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "read") read(msg);
  else if (msg.type === "control") control(msg.readId, msg.action, msg.index);
  else if (msg.type === "speed") speed = msg.speed;
});
