// Okunan kelimeyi CSS Custom Highlight API ile vurgular (sayfa DOM'u değişmez).
// Kelime zamanları lib/align.ts'te hesaplanır (EMA'nın verdiği gerçek zamanlar ya da tahmin).
import type { WordTiming } from "../lib/align";
import type { Span } from "../lib/sentences";
import type { TextMap } from "./textmap";

const NAME = "ema-reader-word";
let timer = 0;
let tick: (() => void) | null = null;
let began = 0; // duraklatılan süre kadar ileri kaydırılır
let pausedAt: number | null = null;

function ensureStyle() {
  if (document.getElementById("ema-reader-style")) return;
  const style = document.createElement("style");
  style.id = "ema-reader-style";
  style.textContent = `::highlight(${NAME}) { background-color: #ffe066; color: #000; }`;
  (document.head ?? document.documentElement).append(style);
}

export function clearHighlight() {
  cancelAnimationFrame(timer);
  tick = null;
  pausedAt = null;
  if ("highlights" in CSS) CSS.highlights.delete(NAME);
}

/** Vurgulamayı sesle birlikte dondurur. */
export function pauseHighlight() {
  if (pausedAt !== null) return;
  pausedAt = performance.now();
  cancelAnimationFrame(timer);
}

export function resumeHighlight() {
  if (pausedAt === null) return;
  began += performance.now() - pausedAt;
  pausedAt = null;
  tick?.();
}

/** `offset`: ses cümlenin kaçıncı saniyesinden başladı (sarınca). `paused` ise vurgu devam edilene kadar bekler. */
export function highlightSentence(
  map: TextMap,
  sentence: Span,
  timings: WordTiming[],
  duration: number,
  offset = 0,
  paused = false,
) {
  clearHighlight();
  if (!("highlights" in CSS)) return;
  ensureStyle();

  const words = timings.map((t) => ({ start: sentence.start + t.start, end: sentence.start + t.end }));
  if (!words.length) return;
  const times = timings.map((t) => t.time * 1000);

  began = performance.now() - offset * 1000;
  let shown = -1;
  const step = () => {
    const elapsed = (pausedAt ?? performance.now()) - began;
    let i = shown;
    while (i + 1 < words.length && times[i + 1] <= elapsed) i++;
    if (i !== shown) {
      shown = i;
      const range = map.rangeFor(words[i].start, words[i].end);
      if (range) CSS.highlights.set(NAME, new Highlight(range));
    }
    if (pausedAt !== null) return; // duraklatılmışken o anki kelime görünür kalır
    if (elapsed < duration * 1000) timer = requestAnimationFrame(step);
    else CSS.highlights.delete(NAME);
  };
  tick = step;
  if (paused) pausedAt = performance.now();
  step();
}
