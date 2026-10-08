import { alignTimings, estimateTimings } from "../lib/align";
import type { ContentCommand, ControlAction, ControlRequest, Progress, ReadRequest } from "../lib/messages";
import { splitSentences, type Span } from "../lib/sentences";
import { DEFAULT_SETTINGS, loadSettings, type Settings } from "../lib/settings";
import { Bubble } from "./bubble";
import { clearHighlight, highlightSentence, pauseHighlight, resumeHighlight } from "./highlighter";
import { rangesFrom } from "./readable";
import { TextMap } from "./textmap";

let settings: Settings = DEFAULT_SETTINGS;
loadSettings().then((s) => (settings = s));
chrome.storage.onChanged.addListener(() => loadSettings().then((s) => (settings = s)));

let bubble: Bubble | null = null;
let current: { readId: string; map: TextMap; sentences: Span[]; paused: boolean } | null = null;

function getBubble() {
  if (!bubble) {
    bubble = new Bubble();
    bubble.onPlay = readSelection;
    bubble.onPause = () => control("pause");
    bubble.onResume = () => control("resume");
    bubble.onStop = () => control("stop");
  }
  return bubble;
}

function selectedRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  return range.toString().trim() ? range : null;
}

const RELOADED = "Eklenti yeniden yüklendi, sayfayı yenile.";

function readSelection() {
  const range = selectedRange();
  if (range) startReading(TextMap.fromRange(range));
}

// Sağ tıklanan yer; "Buradan sonrasını oku" buradan başlar.
let contextTarget: Node | null = null;
document.addEventListener("contextmenu", (e) => (contextTarget = e.target as Node), true);

function readFromHere() {
  if (!contextTarget?.isConnected) return;
  const ranges = rangesFrom(contextTarget);
  if (ranges.length) startReading(TextMap.fromRanges(ranges));
}

/** Okunan cümle ekranda değilse sayfayı ona kaydırır. */
function scrollToSentence(map: TextMap, sentence: Span) {
  const r = map.rangeFor(sentence.start, Math.min(sentence.end, sentence.start + 1));
  if (!r) return;
  const rect = r.getBoundingClientRect();
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
  window.scrollBy({ top: rect.top - window.innerHeight / 3, behavior: "smooth" });
}

function startReading(map: TextMap) {
  const sentences = splitSentences(map.text);
  if (!sentences.length) return;
  const readId = crypto.randomUUID();
  current = { readId, map, sentences, paused: false };
  clearHighlight();
  getBubble().setMode("loading");
  const msg: ReadRequest = { type: "read", readId, sentences: sentences.map((s) => s.text) };
  chrome.runtime.sendMessage(msg).catch(() => finish(RELOADED));
}

function finish(error?: string) {
  clearHighlight();
  current = null;
  if (error) getBubble().showError(error);
  else bubble?.finish();
}

function control(action: ControlAction) {
  if (!current) return;
  const msg: ControlRequest = { type: "control", readId: current.readId, action };
  chrome.runtime.sendMessage(msg).catch(() => {});
  if (action === "stop") return finish();
  current.paused = action === "pause";
  if (current.paused) pauseHighlight();
  else resumeHighlight();
  getBubble().setMode(current.paused ? "paused" : "playing");
}

document.addEventListener("mouseup", (e) => {
  if (!settings.bubble || (bubble && e.composedPath().includes(bubble.host))) return;
  // Seçim, mouseup işlendikten sonra kesinleşir.
  setTimeout(() => {
    const range = selectedRange();
    if (range) getBubble().showAt(range.getBoundingClientRect());
    else bubble?.hide();
  });
});

document.addEventListener("selectionchange", () => {
  if (bubble?.visible && !selectedRange() && !bubble.host.matches(":hover")) bubble.hide();
});
window.addEventListener("scroll", () => bubble?.hide(), { capture: true, passive: true });

chrome.runtime.onMessage.addListener((msg: Progress | ContentCommand) => {
  // Alt+S: okuma sürüyorsa durdur, yoksa seçili metni oku.
  if (msg.type === "toggle") {
    if (current) control("stop");
    else readSelection();
    return;
  }
  if (msg.type === "read-from-here") return readFromHere();
  if (!current || msg.readId !== current.readId) return;
  switch (msg.type) {
    case "sentence-start": {
      getBubble().setMode(current.paused ? "paused" : "playing");
      const sentence = current.sentences[msg.index];
      scrollToSentence(current.map, sentence);
      if (!settings.highlight) break;
      // EMA'nın gerçek kelime zamanları; eşlenemezse süreden tahmin.
      const timings = alignTimings(sentence.text, msg.words ?? [], msg.duration) ?? estimateTimings(sentence.text, msg.duration);
      highlightSentence(current.map, sentence, timings, msg.duration, current.paused);
      break;
    }
    case "done":
      finish();
      break;
    case "error":
      finish(msg.message);
      break;
  }
});
