import { describe, expect, it } from "vitest";
import { MAX_SENTENCE_CHARS, splitSentences } from "./sentences";

const texts = (s: string) => splitSentences(s).map((x) => x.text);

describe("splitSentences", () => {
  it("basit cümleleri böler", () => {
    expect(texts("Merhaba dünya. Bugün hava güzel! Yarın ne olacak?")).toEqual([
      "Merhaba dünya.",
      "Bugün hava güzel!",
      "Yarın ne olacak?",
    ]);
  });

  it("kısaltmalarda bölmez", () => {
    expect(texts("Dr. Ahmet ve Prof. Ayşe geldi. Elma, armut vb. meyveler alındı.")).toEqual([
      "Dr. Ahmet ve Prof. Ayşe geldi.",
      "Elma, armut vb. meyveler alındı.",
    ]);
    expect(texts("Ayrıntı için bkz. sf. 12. Örn. bu bir örnek.")).toEqual([
      "Ayrıntı için bkz. sf. 12.",
      "Örn. bu bir örnek.",
    ]);
  });

  it("ondalık sayılarda ve sıra sayılarında bölmez", () => {
    expect(texts("Fiyat 3.5 lira oldu. Oran %2,75 arttı.")).toEqual(["Fiyat 3.5 lira oldu.", "Oran %2,75 arttı."]);
    expect(texts("15. yüzyılda yazıldı. 3. madde iptal edildi.")).toEqual([
      "15. yüzyılda yazıldı.",
      "3. madde iptal edildi.",
    ]);
  });

  it("karışık noktalamayı tek sınır sayar", () => {
    expect(texts("Gerçekten mi?! Evet... Harika!!! Tamam.")).toEqual(["Gerçekten mi?!", "Evet...", "Harika!!!", "Tamam."]);
  });

  it("tırnak ve parantezi cümlede tutar", () => {
    expect(texts('O "Geliyorum." dedi. (Gerçekten.) Sonra gitti.')).toEqual([
      'O "Geliyorum." dedi.',
      "(Gerçekten.)",
      "Sonra gitti.",
    ]);
  });

  it("baş harflerde bölmez", () => {
    expect(texts("A. Yılmaz konuştu. Herkes dinledi.")).toEqual(["A. Yılmaz konuştu.", "Herkes dinledi."]);
  });

  it("satır sonlarında böler ve boş parçaları atar", () => {
    expect(texts("Başlık\n\nİlk paragraf burada.\n  \n- - -\nSon")).toEqual(["Başlık", "İlk paragraf burada.", "Son"]);
  });

  it("konumları kaynak metinle eşleşir", () => {
    const src = "  Bir. İki üç.\nDört?";
    for (const s of splitSentences(src)) expect(src.slice(s.start, s.end)).toBe(s.text);
  });

  it("çok uzun cümleleri parçalar", () => {
    const long = Array.from({ length: 200 }, (_, i) => `kelime${i}`).join(" ") + ".";
    const parts = splitSentences(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.text.length).toBeLessThanOrEqual(MAX_SENTENCE_CHARS);
      expect(long.slice(p.start, p.end)).toBe(p.text);
    }
  });
});
