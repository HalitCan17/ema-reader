// Seçimin yanında çıkan ▶ balonu. Sayfanın CSS'i etkilemesin diye Shadow DOM içinde çizilir.

const CSS_TEXT = `
:host { all: initial; }
.wrap {
  position: fixed; z-index: 2147483647; display: flex; align-items: center; gap: 6px;
  font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #1f2937; color: #fff; border-radius: 16px; padding: 4px 8px 4px 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,.25); max-width: 280px;
}
.wrap[hidden] { display: none; }
button {
  all: unset; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
  background: #f59e0b; color: #111; display: grid; place-items: center; font-size: 12px;
}
button:disabled { cursor: progress; opacity: .7; }
.tag { font-size: 10px; opacity: .75; white-space: nowrap; }
.msg { font-size: 12px; }
.msg:empty { display: none; }
`;

export class Bubble {
  readonly host: HTMLElement;
  private wrap: HTMLDivElement;
  private button: HTMLButtonElement;
  private msg: HTMLSpanElement;
  private hideTimer = 0;
  onPlay: () => void = () => {};

  constructor() {
    this.host = document.createElement("ema-reader-bubble");
    const shadow = this.host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>${CSS_TEXT}</style>
      <div class="wrap" hidden>
        <button type="button" title="Seçili metni oku" aria-label="Seçili metni oku">▶</button>
        <span class="msg"></span>
        <span class="tag" title="Bu ses yapay zekâ ile üretilir">AI sesi</span>
      </div>`;
    this.wrap = shadow.querySelector(".wrap")!;
    this.button = shadow.querySelector("button")!;
    this.msg = shadow.querySelector(".msg")!;
    // Tıklama seçimi silmesin.
    this.wrap.addEventListener("mousedown", (e) => e.preventDefault());
    this.button.addEventListener("click", () => this.onPlay());
    document.documentElement.append(this.host);
  }

  showAt(rect: DOMRect) {
    clearTimeout(this.hideTimer);
    this.setIdle();
    this.wrap.hidden = false;
    const width = this.wrap.offsetWidth;
    const left = Math.min(Math.max(rect.right + 4, 4), window.innerWidth - width - 4);
    const top = rect.bottom + 6 + 30 > window.innerHeight ? rect.top - 34 : rect.bottom + 6;
    this.wrap.style.left = `${left}px`;
    this.wrap.style.top = `${Math.max(top, 4)}px`;
  }

  get visible() {
    return !this.wrap.hidden;
  }

  hide() {
    this.wrap.hidden = true;
  }

  setLoading() {
    this.button.disabled = true;
    this.button.textContent = "…";
    this.msg.textContent = "";
  }

  setIdle() {
    this.button.disabled = false;
    this.button.textContent = "▶";
    this.msg.textContent = "";
  }

  showError(message: string) {
    this.setIdle();
    this.msg.textContent = message;
    this.wrap.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), 6000);
  }
}
