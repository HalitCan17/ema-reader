/** Sarma hedefi: `index` numaralı cümlenin `pos`. saniyesinden `delta` saniye ileri/geri.
 * `durations` bilinen cümle süreleridir; süresi henüz bilinmeyen bir cümleye gelince onun başında durulur.
 * Son cümlenin sonunu geçerse null (okuma biter). */
export function seekTarget(
  index: number,
  pos: number,
  delta: number,
  durations: ReadonlyArray<number | undefined>,
  count: number,
): { index: number; offset: number } | null {
  let i = index;
  let t = pos + delta;
  while (t < 0 && i > 0) {
    const d = durations[i - 1];
    if (d === undefined) return { index: i - 1, offset: 0 };
    i--;
    t += d;
  }
  if (t < 0) t = 0;
  for (;;) {
    const d = durations[i];
    if (d === undefined) return { index: i, offset: 0 };
    if (t < d) return { index: i, offset: t };
    t -= d;
    i++;
    if (i >= count) return null;
    if (durations[i] === undefined) return { index: i, offset: 0 };
  }
}
