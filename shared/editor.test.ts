import { describe, expect, it } from "vitest";
import {
  createProject,
  formatPreset,
  PROJECT_KINDS,
  totalDuration,
} from "./editor";

describe("project presets", () => {
  it("creates every project kind with at least one scene", () => {
    for (const kind of PROJECT_KINDS) {
      const project = createProject(kind.id, kind.label);
      const format = formatPreset(kind.format);

      expect(project.scenes.length).toBeGreaterThan(0);
      expect(project.width).toBe(format.width);
      expect(project.height).toBe(format.height);
      expect(totalDuration(project)).toBeGreaterThan(0);
    }
  });

  it("falls back to a known format when the id is unknown", () => {
    const preset = formatPreset("inexistente" as never);
    expect(preset.id).toBe("hotmart");
  });
});
