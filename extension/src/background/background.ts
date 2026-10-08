import type { OffscreenRead, ProgressEnvelope, ReadRequest } from "../lib/messages";
import { loadSettings } from "../lib/settings";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";
let creating: Promise<void> | null = null;

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });
  if (existing.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Seçili metnin EMA sesini çalmak için",
    })
    .finally(() => (creating = null));
  await creating;
}

async function startReading(msg: ReadRequest, tabId: number) {
  const { port } = await loadSettings();
  await ensureOffscreen();
  const out: OffscreenRead = { target: "offscreen", type: "read", readId: msg.readId, tabId, port, sentences: msg.sentences };
  await chrome.runtime.sendMessage(out);
}

chrome.runtime.onMessage.addListener((msg: ReadRequest | ProgressEnvelope | OffscreenRead, sender) => {
  if ("target" in msg) {
    if (msg.target !== "background") return;
    chrome.tabs.sendMessage(msg.tabId, msg.progress).catch(() => {}); // sekme kapanmış olabilir
  } else if (msg.type === "read" && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id;
    startReading(msg, tabId).catch((err) =>
      chrome.tabs.sendMessage(tabId, { type: "error", readId: msg.readId, message: String(err) }),
    );
  }
});
