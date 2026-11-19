/** Messages exchanged between the editor and the WebCodecs export worker. */

export interface FastExportInit {
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  duration: number;
  totalFrames: number;
  hasAudio: boolean;
  sampleRate: number;
  audioBitrate: number;
  useDisk: boolean;
  fileName: string;
}

export type FastExportToWorker =
  | { type: "init"; config: FastExportInit }
  | {
      type: "audio";
      left: Float32Array;
      right: Float32Array;
      sampleRate: number;
    }
  | { type: "frame"; frame: VideoFrame; keyFrame: boolean }
  | { type: "finish" }
  | { type: "abort" };

export type FastExportFromWorker =
  | { type: "ready"; mode: "disk" | "buffer" }
  | { type: "frameDone" }
  | { type: "progress"; encoded: number; total: number }
  | {
      type: "done";
      mode: "disk" | "buffer";
      fileName?: string;
      size?: number;
      buffer?: ArrayBuffer;
      mimeType: string;
      audioCodec?: "aac" | "opus" | "none";
    }
  | { type: "error"; message: string };
