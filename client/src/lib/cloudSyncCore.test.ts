import { describe, expect, it } from "vitest";
import { chooseSyncAction } from "./cloudSyncCore";

const NOW = 1_800_000_000_000;

describe("chooseSyncAction", () => {
  it("downloads a project that only exists in the cloud", () => {
    expect(
      chooseSyncAction(undefined, {
        id: "p1",
        name: "Nuvem",
        data: { updatedAt: NOW },
      }),
    ).toBe("download");
  });

  it("uploads a project that only exists locally", () => {
    expect(chooseSyncAction({ updatedAt: NOW }, undefined)).toBe("upload");
  });

  it("uploads when the local copy is newer", () => {
    expect(
      chooseSyncAction(
        { updatedAt: NOW + 5_000 },
        { id: "p1", name: "Nuvem", data: { updatedAt: NOW } },
      ),
    ).toBe("upload");
  });

  it("downloads when the cloud copy is newer", () => {
    expect(
      chooseSyncAction(
        { updatedAt: NOW },
        { id: "p1", name: "Nuvem", data: { updatedAt: NOW + 5_000 } },
      ),
    ).toBe("download");
  });

  it("skips when the timestamps are within one second", () => {
    expect(
      chooseSyncAction(
        { updatedAt: NOW },
        { id: "p1", name: "Nuvem", data: { updatedAt: NOW + 400 } },
      ),
    ).toBe("skip");
  });

  it("skips when there is nothing to sync", () => {
    expect(chooseSyncAction(undefined, undefined)).toBe("skip");
  });
});
