// Seçimi düz metne çevirir ve metindeki her karakteri sayfadaki metin düğümüne
// geri eşler; böylece kelimeler sayfa DOM'una dokunmadan Range ile vurgulanabilir.

interface Segment {
  node: Text;
  nodeOffset: number; // düğüm içindeki başlangıç
  textStart: number; // birleştirilmiş metindeki başlangıç
  length: number;
}

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT"]);

function blockOf(node: Node): Element | null {
  let el = node.parentElement;
  while (el) {
    const display = getComputedStyle(el).display;
    if (display !== "inline" && display !== "contents") return el;
    el = el.parentElement;
  }
  return null;
}

export class TextMap {
  readonly text: string;
  private segments: Segment[];

  private constructor(text: string, segments: Segment[]) {
    this.text = text;
    this.segments = segments;
  }

  static fromRange(range: Range): TextMap {
    return TextMap.fromRanges([range]);
  }

  /** Birden fazla aralığı (ör. art arda paragraflar) satır sonlarıyla birleştirir. */
  static fromRanges(ranges: Range[]): TextMap {
    const segments: Segment[] = [];
    let text = "";
    let lastBlock: Element | null = null;

    for (const range of ranges) {
      const add = (node: Text) => {
        if (node.parentElement && SKIP.has(node.parentElement.tagName)) return;
        if (!range.intersectsNode(node)) return;
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.data.length;
        if (end <= start) return;
        const block = blockOf(node);
        // Farklı bloklar (paragraf, başlık, liste öğesi) arasına satır sonu koy.
        if (text && block !== lastBlock) text += "\n";
        lastBlock = block;
        segments.push({ node, nodeOffset: start, textStart: text.length, length: end - start });
        text += node.data.slice(start, end);
      };

      const root = range.commonAncestorContainer;
      if (root.nodeType === Node.TEXT_NODE) add(root as Text);
      else {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) add(n as Text);
      }
      lastBlock = null; // sonraki aralık her zaman yeni satırda başlar
    }
    return new TextMap(text, segments);
  }

  private locate(index: number, isEnd: boolean): { node: Text; offset: number } | null {
    for (const s of this.segments) {
      const inside = isEnd ? index > s.textStart && index <= s.textStart + s.length : index >= s.textStart && index < s.textStart + s.length;
      if (inside) return { node: s.node, offset: s.nodeOffset + index - s.textStart };
    }
    return null;
  }

  /** Birleştirilmiş metindeki [start, end) aralığının sayfadaki Range karşılığı. */
  rangeFor(start: number, end: number): Range | null {
    const a = this.locate(start, false);
    const b = this.locate(end, true);
    if (!a || !b) return null;
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  }
}
