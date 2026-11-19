/**
 * Free caption timing: distributes the script words across the narration
 * duration without calling any speech service. Punctuation gets a small extra
 * pause so the karaoke highlight still follows the voice closely.
 */
import type { WordTiming } from "@shared/editor";

export function estimateWordTimings(
  text: string,
  duration: number
): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || duration <= 0) return [];

  const weights = words.map(word => {
    const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
    const pause = /[.,;!?]$/.test(word) ? 3 : 0;
    return Math.max(2, letters) + pause;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let cursor = 0;
  return words.map((word, index) => {
    const span = (weights[index] / total) * duration;
    const start = cursor;
    cursor += span;
    return {
      word,
      start: Number(start.toFixed(3)),
      end: Number(Math.max(start + 0.08, cursor - 0.04).toFixed(3)),
    };
  });
}
