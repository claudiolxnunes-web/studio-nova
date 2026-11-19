import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  createProject,
  formatPreset,
  migrateProject,
  PROJECT_KINDS,
  totalDuration,
  type Project,
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

describe("project migrations", () => {
  it("upgrades a project saved before schema versioning", () => {
    const legacy = createProject("aula", "Antiga") as Project & {
      schemaVersion?: number;
    };
    delete legacy.schemaVersion;
    legacy.scenes[0].narration.offset = undefined;
    legacy.scenes[0].background.startAt = undefined;

    const migrated = migrateProject(legacy as Project);

    expect(migrated.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated.scenes[0].narration.offset).toBe(0);
    expect(migrated.scenes[0].background.startAt).toBe(0);
  });
});
