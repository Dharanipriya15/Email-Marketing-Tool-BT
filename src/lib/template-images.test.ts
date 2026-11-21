import { describe, expect, it } from "vitest";
import { detectTemplateImageType, formatFileSize } from "@/lib/template-images";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? Array.from(v, (c) => c.charCodeAt(0)) : [v])));

describe("detectTemplateImageType", () => {
  it("recognizes allowed image types by their content", () => {
    expect(detectTemplateImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(detectTemplateImageType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectTemplateImageType(bytes("GIF89a", 0))).toBe("image/gif");
    expect(detectTemplateImageType(bytes("GIF87a", 0))).toBe("image/gif");
    expect(detectTemplateImageType(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects other content regardless of what the file claims to be", () => {
    expect(detectTemplateImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectTemplateImageType(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectTemplateImageType(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull();
    expect(detectTemplateImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectTemplateImageType(new Uint8Array())).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("formats bytes for display", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
