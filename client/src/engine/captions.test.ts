import { describe, expect, it } from "vitest";
import { buildCaptionLines } from "./captions";

describe("buildCaptionLines", () => {
  it("groups words by the configured limit", () => {
    const words = Array.from({ length: 7 }, (_, index) => ({
      word: `palavra${index + 1}`,
      start: index * 0.5,
      end: index * 0.5 + 0.45,
    }));

    const lines = buildCaptionLines(words, "texto", 4, 3);

    expect(lines).toHaveLength(3);
    expect(lines[0].words).toHaveLength(3);
    expect(lines[2].words).toHaveLength(1);
  });

  it("breaks a line on sentence punctuation", () => {
    const words = [
      { word: "Primeira", start: 0, end: 0.3 },
      { word: "frase.", start: 0.3, end: 0.6 },
      { word: "Segunda", start: 0.6, end: 0.9 },
    ];

    const lines = buildCaptionLines(words, "Primeira frase. Segunda", 1, 6);

    expect(lines).toHaveLength(2);
    expect(lines[0].words.map(word => word.word)).toEqual([
      "Primeira",
      "frase.",
    ]);
    expect(lines[1].words[0].word).toBe("Segunda");
  });

  it("estimates timing from the script when no words were transcribed", () => {
    const lines = buildCaptionLines(undefined, "uma duas três quatro", 4, 2);

    expect(lines).toHaveLength(2);
    expect(lines[0].start).toBe(0);
    expect(lines[1].end).toBeCloseTo(4, 5);
  });
});
