// "Buradan sonrasını oku" için sayfadaki okunabilir blokları bulur: paragraflar, başlıklar,
// liste öğeleri ve alıntılar. Menü, kenar çubuğu, alt bilgi ve gizli öğeler atlanır.

const BLOCKS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, dd, dt, figcaption";
const SKIP_INSIDE =
  "nav, aside, footer, form, button, [role=navigation], [role=complementary], [role=contentinfo], [role=menu], [aria-hidden=true], [hidden]";

function visible(el: Element): boolean {
  if ("checkVisibility" in el) return el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  return (el as HTMLElement).offsetParent !== null;
}

function readable(el: Element, start: Element | null): boolean {
  if (!el.textContent?.trim()) return false;
  // Kullanıcı bir kenar çubuğuna/menüye tıkladıysa orayı atlamayız.
  const skipped = el.closest(SKIP_INSIDE);
  if (skipped && !(start && skipped.contains(start))) return false;
  return visible(el);
}

/** Tıklanan yerden itibaren sayfa sırasıyla okunacak blokların aralıkları. */
export function rangesFrom(target: Node): Range[] {
  const start = target instanceof Element ? target : target.parentElement;
  const blocks = [...document.querySelectorAll(BLOCKS)].filter(
    // İç içe bloklarda yalnızca dıştakini al (ör. li > p), metin iki kez okunmasın.
    (el) => !el.parentElement?.closest(BLOCKS),
  );
  const ranges: Range[] = [];
  let started = false;
  for (const el of blocks) {
    if (!started) {
      // Tıklanan öğeyi içeren ya da ondan sonra gelen ilk blok.
      const contains = el.contains(target);
      const after = !!(target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!contains && !after) continue;
      started = true;
    }
    if (!readable(el, start)) continue;
    const r = document.createRange();
    r.selectNodeContents(el);
    ranges.push(r);
  }
  // Tıklanan yer içinde blok olmayan düz bir öğeyse (ör. metin taşıyan bir div) onu da başa ekle.
  if (start && !blocks.some((b) => b.contains(start)) && !start.querySelector(BLOCKS) && start.textContent?.trim()) {
    const r = document.createRange();
    r.selectNodeContents(start);
    ranges.unshift(r);
  }
  return ranges;
}
