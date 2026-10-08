import { describe, expect, it } from "vitest";
import { seekTarget } from "./seek";

describe("seekTarget", () => {
  const d = [4, 3, 6];
  it("aynı cümle içinde sarar", () => {
    expect(seekTarget(2, 5.5, -5, d, 3)).toEqual({ index: 2, offset: 0.5 });
  });
  it("geri sarınca önceki cümlelere geçer", () => {
    expect(seekTarget(2, 1, -2, d, 3)).toEqual({ index: 1, offset: 2 });
    expect(seekTarget(2, 1, -5, d, 3)).toEqual({ index: 0, offset: 3 });
    expect(seekTarget(2, 1, -9, d, 3)).toEqual({ index: 0, offset: 0 });
  });
  it("ilk cümlenin başından öteye gitmez", () => {
    expect(seekTarget(0, 2, -5, d, 3)).toEqual({ index: 0, offset: 0 });
  });
  it("ileri sarınca sonraki cümleye geçer", () => {
    expect(seekTarget(0, 2, 3, d, 3)).toEqual({ index: 1, offset: 1 });
    expect(seekTarget(0, 2, 5, d, 3)).toEqual({ index: 2, offset: 0 });
    expect(seekTarget(0, 3, 5, d, 3)).toEqual({ index: 2, offset: 1 });
  });
  it("süresi bilinmeyen cümlenin başında durur", () => {
    expect(seekTarget(0, 3, 5, [4, undefined, 6], 3)).toEqual({ index: 1, offset: 0 });
  });
  it("sonu geçince null", () => {
    expect(seekTarget(2, 4, 5, d, 3)).toBeNull();
  });
});
