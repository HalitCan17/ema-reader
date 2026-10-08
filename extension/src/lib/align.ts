// Kelime zamanlaması. EMA her kelimenin ne zaman okunduğunu verir, ama okunan
// kelimeler normalleştirilmiş hâldedir ("1990" -> "bin dokuz yüz doksan", küçük harf,
// noktalama yok). Burada bu kelimeler sayfadaki kelimelerle eşlenir: birebir tutanlar
// (en uzun ortak alt dizi ile) çapa olur, arada kalanlar çapaların arasındaki süreye
// harf sayısına göre paylaştırılır.

/** Sunucunun döndürdüğü okunan kelime: [metin, başlangıç sn, bitiş sn]. */
export type SpokenWord = [string, number, number];

/** Cümledeki bir kelime ([start, end) cümle metnindeki konum) ve okunmaya başladığı an (sn). */
export interface WordTiming {
  start: number;
  end: number;
  time: number;
}

const TURKISH = "çğıöşü";

/** EMA'nın alfabesine yakın bir karşılaştırma biçimi: küçük harf, aksansız (Türkçe harfler hariç), yalnızca harf ve rakam. */
export function normalizeWord(word: string): string {
  let out = "";
  for (const ch of word.toLocaleLowerCase("tr")) {
    const base = TURKISH.includes(ch) ? ch : ch.normalize("NFKD").replace(/\p{M}/gu, "");
    out += base.replace(/[^\p{L}\p{N}]/gu, "");
  }
  return out;
}

function wordsOf(text: string) {
  return [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, key: normalizeWord(m[0]) }));
}

/** Gerçek zaman yoksa: cümle süresini kelimelere harf sayısına göre paylaştırır. */
export function estimateTimings(text: string, duration: number): WordTiming[] {
  const words = wordsOf(text);
  const total = words.reduce((n, w) => n + (w.end - w.start) + 1, 0);
  let acc = 0;
  return words.map((w) => {
    const time = total ? (acc / total) * duration : 0;
    acc += w.end - w.start + 1;
    return { start: w.start, end: w.end, time };
  });
}

/** Okunan kelimeleri sayfadaki kelimelerle eşler. Yeterince eşleşme yoksa null döner (tahmine düşülür). */
export function alignTimings(text: string, spoken: SpokenWord[], duration: number): WordTiming[] | null {
  const words = wordsOf(text);
  if (!words.length || !spoken.length) return null;
  const keys = spoken.map((s) => normalizeWord(s[0]));
  const n = words.length;
  const m = keys.length;

  // En uzun ortak alt dizi (cümleler kısa, O(n*m) yeterli).
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = words[i].key && words[i].key === keys[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const match: number[] = new Array(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (words[i].key && words[i].key === keys[j]) match[i++] = j++;
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  const anchors = match.filter((j) => j >= 0).length;
  if (anchors < Math.max(1, Math.ceil(n * 0.3))) return null;

  const times: number[] = new Array(n);
  let i = 0;
  while (i < n) {
    if (match[i] >= 0) {
      times[i] = spoken[match[i]][1];
      i++;
      continue;
    }
    // Eşleşmeyen kelime dizisi [i, k): önceki ve sonraki çapa arasındaki okunan kelimelerin süresini paylaşırlar.
    let k = i;
    while (k < n && match[k] < 0) k++;
    const prevJ = i > 0 ? match[i - 1] : -1;
    const nextJ = k < n ? match[k] : m;
    let from: number, to: number;
    if (nextJ - prevJ > 1) {
      from = spoken[prevJ + 1][1];
      to = spoken[nextJ - 1][2];
    } else {
      from = prevJ >= 0 ? spoken[prevJ][2] : 0;
      to = nextJ < m ? spoken[nextJ][1] : duration;
    }
    const lens = words.slice(i, k).map((w) => w.end - w.start + 1);
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let x = i; x < k; x++) {
      times[x] = from + (to - from) * (acc / total);
      acc += lens[x - i];
    }
    i = k;
  }
  for (let x = 1; x < n; x++) times[x] = Math.max(times[x], times[x - 1]);
  return words.map((w, x) => ({ start: w.start, end: w.end, time: times[x] }));
}
