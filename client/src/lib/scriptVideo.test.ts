import { describe, expect, it } from "vitest";
import { estimateSeconds, splitScript } from "./scriptVideo";

describe("splitScript", () => {
  it("keeps paragraphs as separate scenes", () => {
    const chunks = splitScript(
      "Primeira cena com uma frase.\n\nSegunda cena com outra frase.",
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("Primeira");
    expect(chunks[1]).toContain("Segunda");
  });

  it("respects the maximum length per scene", () => {
    const chunks = splitScript(
      "Uma frase curta. Outra frase curta. Mais uma frase curta. E a última.",
      30,
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(30);
  });

  it("returns nothing for an empty script", () => {
    expect(splitScript("   \n  ")).toEqual([]);
  });
});

describe("estimateSeconds", () => {
  it("never returns less than the minimum scene duration", () => {
    expect(estimateSeconds("oi")).toBeGreaterThanOrEqual(2.5);
  });
});
