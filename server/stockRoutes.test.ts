import { describe, expect, it } from "vitest";
import { extractUnsplashId } from "./stockRoutes";

describe("Unsplash ID extraction", () => {
  it("accepts a raw photo ID", () => {
    expect(extractUnsplashId("pFqrYbhIAXs")).toBe("pFqrYbhIAXs");
  });

  it("extracts the ID from a public unsplash.com link", () => {
    expect(
      extractUnsplashId("https://unsplash.com/photos/a-cat-on-a-desk-KR2mdHJ5qMg"),
    ).toBe("KR2mdHJ5qMg");
  });

  it("extracts the ID from an api.unsplash.com link", () => {
    expect(
      extractUnsplashId("https://api.unsplash.com/photos/KR2mdHJ5qMg"),
    ).toBe("KR2mdHJ5qMg");
  });

  it("rejects invalid input", () => {
    expect(extractUnsplashId("https://example.com/")).toBeNull();
    expect(extractUnsplashId("")).toBeNull();
  });
});
