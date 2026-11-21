import { mkdtemp, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  templateImage: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import {
  TemplateImageNotFoundError,
  TemplateImageValidationError,
  deleteTemplateImage,
  listTemplateImages,
  uploadTemplateImage,
} from "@/services/template-image-service";
import { MAX_TEMPLATE_IMAGE_BYTES } from "@/lib/template-images";

const ORG = "org_1";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let uploadDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  uploadDir = await mkdtemp(path.join(tmpdir(), "template-images-"));
  vi.stubEnv("UPLOAD_DIR", uploadDir);
  vi.stubEnv("APP_URL", "https://email.example.com/");
  prismaMock.templateImage.create.mockImplementation(async ({ data }) => ({
    id: "img_1",
    url: data.url,
    size: data.size,
    createdAt: new Date(),
  }));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(uploadDir, { recursive: true, force: true });
});

describe("uploadTemplateImage", () => {
  it("stores the file under the org folder with a random name and an absolute URL", async () => {
    const image = await uploadTemplateImage(ORG, PNG);

    const files = await readdir(path.join(uploadDir, ORG));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f]{32}\.png$/);

    const { data } = prismaMock.templateImage.create.mock.calls[0][0];
    expect(data).toMatchObject({ organizationId: ORG, filename: files[0], size: PNG.byteLength });
    expect(image.url).toBe(`https://email.example.com/uploads/${ORG}/${files[0]}`);
  });

  it("rejects files whose content is not an allowed image", async () => {
    const svg = new TextEncoder().encode("<svg onload=alert(1)>");
    await expect(uploadTemplateImage(ORG, svg)).rejects.toBeInstanceOf(TemplateImageValidationError);
    expect(prismaMock.templateImage.create).not.toHaveBeenCalled();
  });

  it("rejects files over 2 MB", async () => {
    const big = new Uint8Array(MAX_TEMPLATE_IMAGE_BYTES + 1);
    big.set(PNG);
    await expect(uploadTemplateImage(ORG, big)).rejects.toBeInstanceOf(TemplateImageValidationError);
  });

  it("refuses organization ids that could escape the upload folder", async () => {
    await expect(uploadTemplateImage("../evil", PNG)).rejects.toThrow();
    expect(prismaMock.templateImage.create).not.toHaveBeenCalled();
  });

  it("removes the file when the database write fails", async () => {
    prismaMock.templateImage.create.mockRejectedValue(new Error("db down"));
    await expect(uploadTemplateImage(ORG, PNG)).rejects.toThrow("db down");
    expect(await readdir(path.join(uploadDir, ORG))).toHaveLength(0);
  });
});

describe("listTemplateImages", () => {
  it("only lists the caller's organization", async () => {
    prismaMock.templateImage.findMany.mockResolvedValue([]);
    await listTemplateImages(ORG);
    expect(prismaMock.templateImage.findMany.mock.calls[0][0].where).toEqual({ organizationId: ORG });
  });
});

describe("deleteTemplateImage", () => {
  it("deletes the org-scoped row and its file", async () => {
    await mkdir(path.join(uploadDir, ORG), { recursive: true });
    await writeFile(path.join(uploadDir, ORG, "abc.png"), PNG);
    prismaMock.templateImage.findFirst.mockResolvedValue({ filename: "abc.png" });
    prismaMock.templateImage.deleteMany.mockResolvedValue({ count: 1 });

    await deleteTemplateImage(ORG, "img_1");

    expect(prismaMock.templateImage.findFirst.mock.calls[0][0].where).toEqual({ id: "img_1", organizationId: ORG });
    expect(prismaMock.templateImage.deleteMany.mock.calls[0][0].where).toEqual({ id: "img_1", organizationId: ORG });
    expect(await readdir(path.join(uploadDir, ORG))).toHaveLength(0);
  });

  it("throws not found for images in another organization", async () => {
    prismaMock.templateImage.findFirst.mockResolvedValue(null);
    await expect(deleteTemplateImage(ORG, "img_other")).rejects.toBeInstanceOf(TemplateImageNotFoundError);
    expect(prismaMock.templateImage.deleteMany).not.toHaveBeenCalled();
  });

  it("still succeeds when the file is already gone", async () => {
    prismaMock.templateImage.findFirst.mockResolvedValue({ filename: "missing.png" });
    prismaMock.templateImage.deleteMany.mockResolvedValue({ count: 1 });
    await expect(deleteTemplateImage(ORG, "img_1")).resolves.toBeUndefined();
  });
});
