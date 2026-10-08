import type { Progress, ReadRequest } from "../lib/messages";
import { splitSentences, type Span } from "../lib/sentences";
import { DEFAULT_SETTINGS, loadSettings, type Settings } from "../lib/settings";
import { Bubble } from "./bubble";
import { clearHighlight, highlightSentence } from "./highlighter";
import { TextMap } from "./textmap";

let settings: Settings = DEFAULT_SETTINGS;
loadSettings().then((s) => (settings = s));
chrome.storage.onChanged.addListener(() => loadSettings().then((s) => (settings = s)));

let bubble: Bubble | null = null;
let current: { readId: string; map: TextMap; sentences: Span[] } | null = null;

function getBubble() {
  bubble ??= new Bubble();
  bubble.onPlay = readSelection;
  return bubble;
}

function selectedRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  return range.toString().trim() ? range : null;
}

function readSelection() {
  const range = selectedRange();
  if (!range) return;
  const map = TextMap.fromRange(range);
  const sentences = splitSentences(map.text);
  if (!sentences.length) return;
  const readId = crypto.randomUUID();
  current = { readId, map, sentences };
  clearHighlight();
  getBubble().setLoading();
  const msg: ReadRequest = { type: "read", readId, sentences: sentences.map((s) => s.text) };
  chrome.runtime.sendMessage(msg).catch(() => getBubble().showError("Eklenti yeniden yüklendi, sayfayı yenile."));
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

chrome.runtime.onMessage.addListener((msg: Progress) => {
  if (!current || msg.readId !== current.readId) return;
  switch (msg.type) {
    case "sentence-start":
      if (msg.index === 0) bubble?.hide();
      if (settings.highlight) highlightSentence(current.map, current.sentences[msg.index], msg.duration);
      break;
    case "done":
      clearHighlight();
      current = null;
      break;
    case "error":
      clearHighlight();
      current = null;
      getBubble().showError(msg.message);
      break;
  }
});
