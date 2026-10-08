// Seçimin yanında çıkan ▶ balonu. Okuma başlayınca sağ alt köşeye yerleşip
// 5 sn geri / duraklat-devam / 5 sn ileri / durdur düğmeleri olan küçük bir oynatıcıya dönüşür.
// Sayfanın CSS'i etkilemesin diye Shadow DOM içinde çizilir.

const CSS_TEXT = `
:host { all: initial; }
.wrap {
  position: fixed; z-index: 2147483647; display: flex; align-items: center; gap: 6px;
  font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #1f2937; color: #fff; border-radius: 16px; padding: 4px 8px 4px 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,.25); max-width: 280px;
}
.wrap[hidden] { display: none; }
.wrap.player { left: auto !important; top: auto !important; right: 16px; bottom: 16px; }
button {
  all: unset; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
  background: #f59e0b; color: #111; display: grid; place-items: center; font-size: 12px;
}
button[hidden] { display: none; }
button.stop, button.seek { background: #4b5563; color: #fff; font-size: 10px; }
button:disabled { cursor: progress; opacity: .7; }
.tag { font-size: 10px; opacity: .75; white-space: nowrap; }
.msg { font-size: 12px; }
.msg:empty { display: none; }
`;

type Mode = "idle" | "loading" | "playing" | "paused";

export class Bubble {
  readonly host: HTMLElement;
  private wrap: HTMLDivElement;
  private main: HTMLButtonElement;
  private stop: HTMLButtonElement;
  private seekButtons: HTMLButtonElement[];
  private msg: HTMLSpanElement;
  private hideTimer = 0;
  private mode: Mode = "idle";
  onPlay: () => void = () => {};
  onPause: () => void = () => {};
  onResume: () => void = () => {};
  onStop: () => void = () => {};
  onSeek: (direction: "back" | "forward") => void = () => {};

  constructor() {
    this.host = document.createElement("ema-reader-bubble");
    const shadow = this.host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>${CSS_TEXT}</style>
      <div class="wrap" hidden>
        <button type="button" class="seek" data-dir="back" title="5 sn geri" aria-label="5 saniye geri" hidden>−5</button>
        <button type="button" class="main"></button>
        <button type="button" class="seek" data-dir="forward" title="5 sn ileri" aria-label="5 saniye ileri" hidden>+5</button>
        <button type="button" class="stop" title="Durdur" aria-label="Durdur" hidden>■</button>
        <span class="msg"></span>
        <span class="tag" title="Bu ses yapay zekâ ile üretilir">AI sesi</span>
      </div>`;
    this.wrap = shadow.querySelector(".wrap")!;
    this.main = shadow.querySelector(".main")!;
    this.stop = shadow.querySelector(".stop")!;
    this.seekButtons = [...shadow.querySelectorAll<HTMLButtonElement>(".seek")];
    this.msg = shadow.querySelector(".msg")!;
    // Tıklama seçimi silmesin.
    this.wrap.addEventListener("mousedown", (e) => e.preventDefault());
    this.main.addEventListener("click", () => {
      if (this.mode === "idle") this.onPlay();
      else if (this.mode === "playing") this.onPause();
      else if (this.mode === "paused") this.onResume();
    });
    this.stop.addEventListener("click", () => this.onStop());
    for (const b of this.seekButtons) b.addEventListener("click", () => this.onSeek(b.dataset.dir as "back" | "forward"));
    document.documentElement.append(this.host);
    this.setMode("idle");
  }

  /** Okuma sürerken balon oynatıcıdır; seçim ve kaydırma onu gizlemez. */
  get isPlayer() {
    return this.mode !== "idle";
  }

  get visible() {
    return !this.wrap.hidden;
  }

  showAt(rect: DOMRect) {
    if (this.isPlayer) return;
    clearTimeout(this.hideTimer);
    this.msg.textContent = "";
    this.wrap.hidden = false;
    const width = this.wrap.offsetWidth;
    const left = Math.min(Math.max(rect.right + 4, 4), window.innerWidth - width - 4);
    const top = rect.bottom + 6 + 30 > window.innerHeight ? rect.top - 34 : rect.bottom + 6;
    this.wrap.style.left = `${left}px`;
    this.wrap.style.top = `${Math.max(top, 4)}px`;
  }

  hide() {
    if (!this.isPlayer) this.wrap.hidden = true;
  }

  setMode(mode: Mode) {
    this.mode = mode;
    const [icon, label] = { idle: ["▶", "Seçili metni oku"], loading: ["…", "Hazırlanıyor"], playing: ["❚❚", "Duraklat"], paused: ["▶", "Devam et"] }[mode];
    this.main.textContent = icon;
    this.main.title = label;
    this.main.setAttribute("aria-label", label);
    this.main.disabled = mode === "loading";
    this.stop.hidden = mode === "idle";
    for (const b of this.seekButtons) b.hidden = mode === "idle";
    this.wrap.classList.toggle("player", mode !== "idle");
    if (mode !== "idle") {
      clearTimeout(this.hideTimer);
      this.msg.textContent = "";
      this.wrap.hidden = false;
    }
  }

  /** Okuma bitti: oynatıcıyı kapat. */
  finish() {
    this.setMode("idle");
    this.wrap.hidden = true;
  }

  showError(message: string) {
    this.setMode("idle");
    this.msg.textContent = message;
    this.wrap.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), 6000);
  }
}
