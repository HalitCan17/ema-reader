// Eklentinin parçaları arasındaki mesajlar.
// İçerik betiği -> arka plan -> offscreen belgesi (sunucuya istek ve ses çalma),
// offscreen -> arka plan -> içerik betiği (ilerleme olayları).

/** İçerik betiğinden: bu cümleleri oku. */
export interface ReadRequest {
  type: "read";
  readId: string;
  sentences: string[];
}

/** Arka plandan offscreen belgesine. */
export interface OffscreenRead {
  target: "offscreen";
  type: "read";
  readId: string;
  tabId: number;
  port: number;
  sentences: string[];
}

/** Offscreen belgesinden içerik betiğine giden ilerleme olayları. */
export type Progress =
  | { type: "sentence-start"; readId: string; index: number; duration: number }
  | { type: "done"; readId: string }
  | { type: "error"; readId: string; message: string };

export interface ProgressEnvelope {
  target: "background";
  tabId: number;
  progress: Progress;
}
