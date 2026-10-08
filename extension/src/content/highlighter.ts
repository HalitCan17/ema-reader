// Okunan kelimeyi CSS Custom Highlight API ile vurgular (sayfa DOM'u değişmez).
// Model kelime zamanı vermediği için cümle süresi karakter sayısına göre kelimelere paylaştırılır.
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

/** `paused` ise ses henüz çalmıyordur; vurgu devam edilene kadar bekler. */
export function highlightSentence(map: TextMap, sentence: Span, duration: number, paused = false) {
  clearHighlight();
  if (!("highlights" in CSS)) return;
  ensureStyle();

  const words = [...sentence.text.matchAll(/\S+/g)].map((m) => ({
    start: sentence.start + m.index,
    end: sentence.start + m.index + m[0].length,
  }));
  if (!words.length) return;
  const total = words.reduce((n, w) => n + (w.end - w.start) + 1, 0);
  const times: number[] = [];
  let acc = 0;
  for (const w of words) {
    times.push((acc / total) * duration * 1000);
    acc += w.end - w.start + 1;
  }

  began = performance.now();
  let shown = -1;
  const step = () => {
    if (pausedAt !== null) return;
    const elapsed = performance.now() - began;
    let i = shown;
    while (i + 1 < words.length && times[i + 1] <= elapsed) i++;
    if (i !== shown) {
      shown = i;
      const range = map.rangeFor(words[i].start, words[i].end);
      if (range) CSS.highlights.set(NAME, new Highlight(range));
    }
    if (elapsed < duration * 1000) timer = requestAnimationFrame(step);
    else CSS.highlights.delete(NAME);
  };
  tick = step;
  if (paused) pausedAt = began;
  step();
}
