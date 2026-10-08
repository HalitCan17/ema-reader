// Eklentinin parçaları arasındaki mesajlar.
// İçerik betiği -> arka plan -> offscreen belgesi (sunucuya istek ve ses çalma),
// offscreen -> arka plan -> içerik betiği (ilerleme olayları).
import type { SpokenWord } from "./align";

export type ControlAction = "pause" | "resume" | "stop";

/** İçerik betiğinden: bu cümleleri oku. */
export interface ReadRequest {
  type: "read";
  readId: string;
  sentences: string[];
}

/** İçerik betiğinden: süren okumayı duraklat, devam ettir veya durdur. */
export interface ControlRequest {
  type: "control";
  readId: string;
  action: ControlAction;
}

/** Arka plandan içerik betiğine: Alt+S kısayoluna basıldı ya da sağ tık menüsünden "Buradan sonrasını oku" seçildi. */
export type ContentCommand = { type: "toggle" } | { type: "read-from-here" };

/** Arka plandan offscreen belgesine. */
export type OffscreenMessage =
  | { target: "offscreen"; type: "read"; readId: string; tabId: number; port: number; speed: number; sentences: string[] }
  | { target: "offscreen"; type: "control"; readId: string; action: ControlAction }
  | { target: "offscreen"; type: "speed"; speed: number };

/** Offscreen belgesinden içerik betiğine giden ilerleme olayları. */
export type Progress =
  | { type: "sentence-start"; readId: string; index: number; duration: number; words: SpokenWord[] }
  | { type: "done"; readId: string }
  | { type: "error"; readId: string; message: string };

export interface ProgressEnvelope {
  target: "background";
  tabId: number;
  progress: Progress;
}
