import type { ContentCommand, ControlRequest, OffscreenMessage, ProgressEnvelope, ReadRequest } from "../lib/messages";
import { loadSettings } from "../lib/settings";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";
let creating: Promise<void> | null = null;

async function hasOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  return existing.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Seçili metnin EMA sesini çalmak için",
    })
    .finally(() => (creating = null));
  await creating;
}

function toOffscreen(msg: OffscreenMessage) {
  return chrome.runtime.sendMessage(msg);
}

async function startReading(msg: ReadRequest, tabId: number) {
  const { port, speed } = await loadSettings();
  await ensureOffscreen();
  await toOffscreen({ target: "offscreen", type: "read", readId: msg.readId, tabId, port, speed, sentences: msg.sentences });
}

chrome.runtime.onMessage.addListener((msg: ReadRequest | ControlRequest | ProgressEnvelope | OffscreenMessage, sender) => {
  if ("target" in msg) {
    if (msg.target !== "background") return;
    chrome.tabs.sendMessage(msg.tabId, msg.progress).catch(() => {}); // sekme kapanmış olabilir
  } else if (msg.type === "read" && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id;
    startReading(msg, tabId).catch((err) =>
      chrome.tabs.sendMessage(tabId, { type: "error", readId: msg.readId, message: String(err) }),
    );
  } else if (msg.type === "control") {
    hasOffscreen().then((ok) => ok && toOffscreen({ target: "offscreen", ...msg }).catch(() => {}));
  }
});

// Hız okuma sırasında değişirse sıradaki cümlelerden itibaren uygulanır.
chrome.storage.onChanged.addListener(async (changes) => {
  const speed = changes.speed?.newValue;
  if (typeof speed === "number" && (await hasOffscreen())) toOffscreen({ target: "offscreen", type: "speed", speed }).catch(() => {});
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-read") return;
  const tabId = tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (tabId === undefined) return;
  const msg: ContentCommand = { type: "toggle" };
  chrome.tabs.sendMessage(tabId, msg).catch(() => {}); // chrome:// gibi sayfalarda içerik betiği yok
});

const READ_FROM_HERE = "read-from-here";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: READ_FROM_HERE, title: "Buradan sonrasını oku", contexts: ["page", "selection", "link"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== READ_FROM_HERE || tab?.id === undefined) return;
  const msg: ContentCommand = { type: "read-from-here" };
  // Tıklanan çerçeveye gönder; sağ tık o çerçevenin içerik betiğinde kaydedildi.
  chrome.tabs.sendMessage(tab.id, msg, { frameId: info.frameId ?? 0 }).catch(() => {});
});
