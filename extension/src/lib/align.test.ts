import { describe, expect, it } from "vitest";
import { alignTimings, estimateTimings, normalizeWord, type SpokenWord } from "./align";

const at = (text: string, spoken: SpokenWord[], duration = 5) =>
  alignTimings(text, spoken, duration)?.map((t) => [text.slice(t.start, t.end), +t.time.toFixed(2)]);

describe("normalizeWord", () => {
  it("Türkçe küçük harf ve noktalamayı EMA gibi işler", () => {
    expect(normalizeWord("İSTANBUL'da,")).toBe("istanbulda");
    expect(normalizeWord("Işık.")).toBe("ışık");
    expect(normalizeWord("café")).toBe("cafe");
    expect(normalizeWord("—")).toBe("");
  });
});

describe("alignTimings", () => {
  it("birebir kelimelerde gerçek zamanları kullanır", () => {
    expect(at("Merhaba, dünya!", [["merhaba", 0.1, 0.6], ["dünya", 0.8, 1.2]])).toEqual([
      ["Merhaba,", 0.1],
      ["dünya!", 0.8],
    ]);
  });

  it("sayının açılımını tek kelimeye toplar", () => {
    expect(
      at("Yıl 1990 oldu.", [["yıl", 0, 0.3], ["bin", 0.4, 0.6], ["dokuz", 0.6, 0.9], ["yüz", 0.9, 1.1], ["doksan", 1.1, 1.5], ["oldu", 1.6, 2]]),
    ).toEqual([
      ["Yıl", 0],
      ["1990", 0.4],
      ["oldu.", 1.6],
    ]);
  });

  it("art arda eşleşmeyenleri aradaki süreye paylaştırır", () => {
    const r = at("Dr. Ali 5 TL verdi.", [["doktor", 0, 0.5], ["ali", 0.6, 0.9], ["beş", 1, 1.2], ["türk", 1.2, 1.4], ["lirası", 1.4, 1.8], ["verdi", 1.9, 2.3]]);
    expect(r?.map((x) => x[0])).toEqual(["Dr.", "Ali", "5", "TL", "verdi."]);
    expect(r?.[0][1]).toBe(0);
    expect(r?.[1][1]).toBe(0.6);
    expect(r?.[2][1]).toBe(1);
    expect((r?.[3][1] as number) > 1 && (r?.[3][1] as number) < 1.8).toBe(true);
    expect(r?.[4][1]).toBe(1.9);
  });

  it("zamanlar hiç geri gitmez", () => {
    const r = alignTimings("a b c d", [["a", 0, 0.2], ["x", 0.2, 0.4], ["d", 0.5, 0.7]], 1)!;
    for (let i = 1; i < r.length; i++) expect(r[i].time).toBeGreaterThanOrEqual(r[i - 1].time);
  });

  it("eşleşme çok azsa null döner", () => {
    expect(alignTimings("bir iki üç dört beş", [["xx", 0, 1]], 1)).toBeNull();
    expect(alignTimings("bir iki", [], 1)).toBeNull();
  });
});

describe("estimateTimings", () => {
  it("süreyi harf sayısına göre paylaştırır", () => {
    const r = estimateTimings("ab cd", 1);
    expect(r.map((t) => t.time)).toEqual([0, 0.5]);
  });
});
