import { describe, expect, it } from "vitest";
import {
  applyWorkflowPlaceholders,
  buildTextToImageWorkflow,
  type ComfyWorkflowValues,
} from "./comfyRoutes";

const values: ComfyWorkflowValues = {
  PROMPT: "a cat on a desk",
  NEGATIVE: "blurry",
  SEED: 42,
  WIDTH: 1024,
  HEIGHT: 768,
  STEPS: 25,
  CFG: 7,
  CHECKPOINT: "sd_xl_base_1.0.safetensors",
};

describe("ComfyUI workflow builder", () => {
  it("builds a standard text-to-image graph", () => {
    const workflow = buildTextToImageWorkflow(values) as Record<string, any>;

    expect(workflow["3"].class_type).toBe("KSampler");
    expect(workflow["4"].inputs.ckpt_name).toBe(values.CHECKPOINT);
    expect(workflow["5"].inputs.width).toBe(1024);
    expect(workflow["5"].inputs.height).toBe(768);
    expect(workflow["6"].inputs.text).toBe(values.PROMPT);
    expect(workflow["7"].inputs.text).toBe(values.NEGATIVE);
    expect(workflow["9"].class_type).toBe("SaveImage");
  });

  it("replaces exact and embedded placeholders in a custom workflow", () => {
    const custom = {
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: "{{SEED}}",
          steps: "{{STEPS}}",
          cfg: "{{CFG}}",
        },
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: "photo of {{PROMPT}}, {{NEGATIVE}}" },
      },
      "4": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: "{{CHECKPOINT}}" },
      },
    };

    const filled = applyWorkflowPlaceholders(custom, values) as Record<string, any>;

    expect(filled["3"].inputs.seed).toBe(42);
    expect(filled["3"].inputs.steps).toBe(25);
    expect(filled["6"].inputs.text).toBe("photo of a cat on a desk, blurry");
    expect(filled["4"].inputs.ckpt_name).toBe(values.CHECKPOINT);
  });
});
