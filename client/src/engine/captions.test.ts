import { describe, expect, it } from "vitest";
import { createProject } from "@shared/editor";
import {
  buildCaptionLines,
  captionsToSrt,
  captionsToVtt,
} from "./captions";

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

describe("caption files", () => {
  it("exports SRT with absolute scene times", () => {
    const project = createProject("aula", "Teste");
    project.scenes[0].narration.text = "Primeira frase. Segunda frase.";
    project.scenes[0].narration.duration = 2;
    project.scenes[1].narration.text = "Terceira frase.";
    project.scenes[1].narration.duration = 1;

    const srt = captionsToSrt(project);

    expect(srt).toContain("1\n00:00:00,000 -->");
    expect(srt).toContain("Primeira frase.");
    expect(srt).toContain("Terceira frase.");
  });

  it("exports WebVTT with the required header", () => {
    const project = createProject("post", "Teste");
    project.scenes[0].narration.text = "Olá mundo.";
    project.scenes[0].narration.duration = 1;

    const vtt = captionsToVtt(project);

    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 -->");
  });
});
