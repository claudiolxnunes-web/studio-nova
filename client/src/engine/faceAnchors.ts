/**
 * Face anchors with MediaPipe (runs locally in the browser).
 *
 * The old heuristic put the mouth roughly where the nose was, which made the
 * portrait look like a cutout. With real landmarks we know exactly where the
 * eyes and the lips are, so the warp lands on the right pixels.
 *
 * The model and the wasm runtime are served from /public, so this works
 * offline after the first load and never sends the photo anywhere.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export interface FaceAnchors {
  /** Normalised (0..1) coordinates inside the source image. */
  eyeY: number;
  eyeLeftX: number;
  eyeRightX: number;
  mouthX: number;
  mouthY: number;
  /** Full mouth width in normalised units. */
  mouthW: number;
  face: { x: number; y: number; w: number; h: number };
}

const LANDMARKS = {
  leftEyeA: 159,
  leftEyeB: 145,
  rightEyeA: 386,
  rightEyeB: 374,
  upperLip: 13,
  lowerLip: 14,
  mouthLeft: 61,
  mouthRight: 291,
  forehead: 10,
  chin: 152,
  cheekLeft: 234,
  cheekRight: 454,
};

let landmarkerPromise: Promise<FaceLandmarker | null> | null = null;

async function create(delegate: "GPU" | "CPU"): Promise<FaceLandmarker> {
  // Loaded only when a photo avatar actually needs landmarks. Keeping this
  // dynamic removes MediaPipe from the editor's initial bundle and avoids a
  // ~33 MB download for users who only import backgrounds.
  const { FaceLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate,
    },
    runningMode: "IMAGE",
    numFaces: 1,
  });
}

function getLandmarker(): Promise<FaceLandmarker | null> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        return await create("GPU");
      } catch {
        try {
          return await create("CPU");
        } catch {
          return null;
        }
      }
    })();
  }
  return landmarkerPromise;
}

interface Point {
  x: number;
  y: number;
}

function midpoint(a: Point | undefined, b: Point | undefined): Point | null {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export async function detectFaceAnchors(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<FaceAnchors | null> {
  const landmarker = await getLandmarker();
  if (!landmarker) return null;

  try {
    const result = landmarker.detect(image);
    const points = result.faceLandmarks?.[0] as Point[] | undefined;
    if (!points || points.length < 400) return null;

    const leftEye = midpoint(points[LANDMARKS.leftEyeA], points[LANDMARKS.leftEyeB]);
    const rightEye = midpoint(points[LANDMARKS.rightEyeA], points[LANDMARKS.rightEyeB]);
    const upper = points[LANDMARKS.upperLip];
    const lower = points[LANDMARKS.lowerLip];
    const mouthLeft = points[LANDMARKS.mouthLeft];
    const mouthRight = points[LANDMARKS.mouthRight];
    const forehead = points[LANDMARKS.forehead];
    const chin = points[LANDMARKS.chin];
    if (!leftEye || !rightEye || !upper || !lower || !mouthLeft || !mouthRight) return null;

    const mouth = midpoint(upper, lower) ?? upper;
    const x0 = Math.min(points[LANDMARKS.cheekLeft].x, points[LANDMARKS.cheekRight].x);
    const x1 = Math.max(points[LANDMARKS.cheekLeft].x, points[LANDMARKS.cheekRight].x);
    const y0 = Math.min(forehead.y, chin.y);
    const y1 = Math.max(forehead.y, chin.y);

    return {
      eyeY: (leftEye.y + rightEye.y) / 2,
      eyeLeftX: leftEye.x,
      eyeRightX: rightEye.x,
      mouthX: mouth.x,
      mouthY: mouth.y,
      mouthW: Math.abs(mouthRight.x - mouthLeft.x),
      face: {
        x: Math.max(0, x0),
        y: Math.max(0, y0),
        w: Math.min(1, Math.abs(x1 - x0)),
        h: Math.min(1, Math.abs(y1 - y0)),
      },
    };
  } catch {
    return null;
  }
}

/** Releases the model when the editor is torn down. */
export function releaseFaceLandmarker(): void {
  void landmarkerPromise?.then(landmarker => landmarker?.close()).catch(() => undefined);
  landmarkerPromise = null;
}
