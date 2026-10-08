/** Metnin bir parçası ve kaynak metindeki konumu ([start, end)). */
export interface Span {
  text: string;
  start: number;
  end: number;
}

/** Sunucu tek seferde en fazla 2000 karakter kabul eder; daha kısa parçalar ilk sesi hızlandırır. */
export const MAX_SENTENCE_CHARS = 400;

// Arkasından nokta gelse bile cümle bitirmeyen kısaltmalar (küçük harfle, noktasız).
const ABBREVIATIONS = new Set([
  "dr", "prof", "doç", "doc", "yrd", "uzm", "av", "op", "müh", "öğr", "gör", "arş",
  "vb", "vs", "örn", "sf", "s", "bkz", "yy", "no", "nu", "tel", "st", "sn", "sy",
  "mah", "cad", "sok", "apt", "bl", "kat", "mr", "mrs", "ms", "jr", "sr", "vd", "çev", "haz", "ed",
]);

const TERMINATORS = ".!?…";
const CLOSERS = "\"'”’»)]";

function lastWord(text: string, end: number): string {
  let i = end;
  while (i > 0 && !/\s/.test(text[i - 1])) i--;
  return text.slice(i, end).replace(/^["'“‘«(\[]+/, "");
}

function isBoundary(text: string, dot: number, next: number): boolean {
  // Yalnızca tek nokta için kısaltma ve sıra sayısı kontrolü yapılır; "?!" ve "..." her zaman biter.
  if (text[dot] !== "." || (dot > 0 && TERMINATORS.includes(text[dot - 1]))) return true;
  const word = lastWord(text, dot).toLocaleLowerCase("tr");
  if (ABBREVIATIONS.has(word)) return false;
  if (/^\p{Lu}$/u.test(lastWord(text, dot))) return false; // "A. Yılmaz" gibi baş harfler
  const nextChar = text[next] ?? "";
  // Küçük harfle devam ediyorsa ("3. madde", "15. yüzyıl") cümle bitmemiştir.
  if (/\p{Ll}/u.test(nextChar)) return false;
  return true;
}

/** Çok uzun bir parçayı boşluklardan bölerek MAX_SENTENCE_CHARS altına indirir. */
function splitLong(span: Span): Span[] {
  const out: Span[] = [];
  let { text, start } = span;
  while (text.length > MAX_SENTENCE_CHARS) {
    let cut = text.lastIndexOf(" ", MAX_SENTENCE_CHARS);
    const comma = text.lastIndexOf(", ", MAX_SENTENCE_CHARS);
    if (comma > MAX_SENTENCE_CHARS / 2) cut = comma + 1;
    if (cut <= 0) cut = MAX_SENTENCE_CHARS;
    const head = text.slice(0, cut).trimEnd();
    out.push({ text: head, start, end: start + head.length });
    const rest = text.slice(cut);
    const skipped = rest.length - rest.trimStart().length;
    start += cut + skipped;
    text = rest.trimStart();
  }
  if (text) out.push({ text, start, end: start + text.length });
  return out;
}

/** Metni cümlelere böler. Satır sonları (ör. başlık ile paragraf arası) her zaman cümle sınırıdır. */
export function splitSentences(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;

  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (/[\p{L}\p{N}]/u.test(trimmed)) {
      spans.push(...splitLong({ text: trimmed, start: start + lead, end: start + lead + trimmed.length }));
    }
    start = end;
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      push(i);
      i++;
      continue;
    }
    if (TERMINATORS.includes(ch)) {
      const dot = i;
      while (i + 1 < text.length && TERMINATORS.includes(text[i + 1])) i++;
      let end = i + 1;
      while (end < text.length && CLOSERS.includes(text[end])) end++;
      if (end >= text.length) break;
      if (/\s/.test(text[end])) {
        let next = end;
        while (next < text.length && /\s/.test(text[next]) && text[next] !== "\n") next++;
        if (isBoundary(text, i === dot ? dot : i, next)) {
          push(end);
          i = end;
          continue;
        }
      }
    }
    i++;
  }
  push(text.length);
  return spans;
}
