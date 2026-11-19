import { describe, expect, it } from "vitest";
import { buildPostCaption, buildPostSlides } from "./scriptPost";

const SCRIPT = `Você não precisa de mais tempo, precisa de menos decisões.

O primeiro passo é escolher uma única prioridade por dia. Pare de tentar fazer tudo ao mesmo tempo.

O segundo passo é reservar um bloco de 30 minutos sem notificações.

O terceiro passo é revisar no fim do dia e ajustar amanhã.`;

describe("buildPostSlides", () => {
  it("creates a single slide for a post", () => {
    const slides = buildPostSlides(SCRIPT, "post", "Rotina simples");

    expect(slides).toHaveLength(1);
    expect(slides[0].headline).toBe("Rotina simples");
    expect(slides[0].template).toBe("feed");
  });

  it("creates cover, content and CTA for a carousel", () => {
    const slides = buildPostSlides(SCRIPT, "carrossel", "Rotina simples");

    expect(slides.length).toBeGreaterThanOrEqual(3);
    expect(slides[0].template).toBe("feed");
    expect(slides[slides.length - 1].template).toBe("cta");
    expect(slides.some(slide => slide.headline.includes("prioridade"))).toBe(
      true,
    );
  });

  it("keeps story sequences short", () => {
    const slides = buildPostSlides(SCRIPT, "story", "Rotina simples");
    expect(slides.length).toBeLessThanOrEqual(4);
  });

  it("rejects an empty script", () => {
    expect(() => buildPostSlides("   ", "post")).toThrow();
  });
});

describe("buildPostCaption", () => {
  it("includes hook, CTA and hashtags", () => {
    const { caption, hashtags } = buildPostCaption(
      SCRIPT,
      "carrossel",
      "Rotina simples",
      "produtividade",
    );

    expect(caption).toContain("Rotina simples");
    expect(caption).toContain("Salve este carrossel");
    expect(hashtags).toContain("#produtividade");
    expect(hashtags.split(" ").length).toBeLessThanOrEqual(10);
  });
});
