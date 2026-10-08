// Eklentinin parçaları arasındaki mesajlar.
// İçerik betiği -> arka plan -> offscreen belgesi (sunucuya istek ve ses çalma),
// offscreen -> arka plan -> içerik betiği (ilerleme olayları).
import type { SpokenWord } from "./align";

/** back/forward 5 sn sarar; jump `index` numaralı cümleye atlar. */
export type ControlAction = "pause" | "resume" | "stop" | "back" | "forward" | "jump";

/** İçerik betiğinden: bu cümleleri oku. */
export interface ReadRequest {
  type: "read";
  readId: string;
  sentences: string[];
}

/** İçerik betiğinden: süren okumayı duraklat, devam ettir, durdur, sar ya da bir cümleye atla. */
export interface ControlRequest {
  type: "control";
  readId: string;
  action: ControlAction;
  index?: number;
}

/** Arka plandan içerik betiğine: Alt+S kısayoluna basıldı ya da sağ tık menüsünden "Buradan sonrasını oku" seçildi. */
export type ContentCommand = { type: "toggle" } | { type: "read-from-here" };

/** Arka plandan offscreen belgesine. */
export type OffscreenMessage =
  | { target: "offscreen"; type: "read"; readId: string; tabId: number; port: number; speed: number; sentences: string[] }
  | { target: "offscreen"; type: "control"; readId: string; action: ControlAction; index?: number }
  | { target: "offscreen"; type: "speed"; speed: number };

/** Offscreen belgesinden içerik betiğine giden ilerleme olayları. */
export type Progress =
  /** `offset`: cümlenin kaçıncı saniyesinden çalmaya başlandı (sarınca 0'dan büyük). */
  | { type: "sentence-start"; readId: string; index: number; offset: number; duration: number; words: SpokenWord[] }
  | { type: "done"; readId: string }
  | { type: "error"; readId: string; message: string };

export interface ProgressEnvelope {
  target: "background";
  tabId: number;
  progress: Progress;
}
