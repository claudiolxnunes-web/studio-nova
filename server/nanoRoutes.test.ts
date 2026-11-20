import { describe, expect, it } from "vitest";
import { aspectRatioFor, extractNanoImage } from "./nanoRoutes";

describe("Nano Banana helpers", () => {
  it("picks the closest supported aspect ratio", () => {
    expect(aspectRatioFor(1024, 1024)).toBe("1:1");
    expect(aspectRatioFor(1080, 1350)).toBe("4:5");
    expect(aspectRatioFor(1080, 1920)).toBe("9:16");
    expect(aspectRatioFor(1920, 1080)).toBe("16:9");
    expect(aspectRatioFor(1200, 630)).toBe("16:9");
  });

  it("extracts output_image from the Interactions response", () => {
    const data = "A".repeat(200);
    const image = extractNanoImage({
      output_image: { data, mime_type: "image/png" },
    });
    expect(image?.mime).toBe("image/png");
    expect(image?.data).toBe(data);
  });

  it("extracts an inline image from steps", () => {
    const data = "B".repeat(200);
    const image = extractNanoImage({
      steps: [
        { type: "text", text: "thinking" },
        { type: "image", inline_data: { data, mime_type: "image/jpeg" } },
      ],
    });
    expect(image?.mime).toBe("image/jpeg");
    expect(image?.data).toBe(data);
  });

  it("returns null when there is no image", () => {
    expect(extractNanoImage({ steps: [{ type: "text", text: "hello" }] })).toBeNull();
  });
});
