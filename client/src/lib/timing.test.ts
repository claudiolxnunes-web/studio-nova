import { describe, expect, it } from "vitest";
import { estimateWordTimings } from "./timing";

describe("estimateWordTimings", () => {
  it("distributes every word across the narration duration", () => {
    const words = estimateWordTimings("Olá, mundo! Tudo bem?", 4);

    expect(words).toHaveLength(4);
    expect(words[0].word).toBe("Olá,");
    expect(words[0].start).toBe(0);
    expect(words[3].end).toBeLessThanOrEqual(4.01);
    for (let index = 1; index < words.length; index += 1) {
      expect(words[index].start).toBeGreaterThanOrEqual(words[index - 1].start);
      expect(words[index].end).toBeGreaterThan(words[index].start);
    }
  });

  it("returns an empty list when there is no text or duration", () => {
    expect(estimateWordTimings("", 5)).toEqual([]);
    expect(estimateWordTimings("Olá", 0)).toEqual([]);
  });
});
