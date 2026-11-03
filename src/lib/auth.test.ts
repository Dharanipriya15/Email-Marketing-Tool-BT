import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifySessionToken: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "bt_session",
  SESSION_DURATION_SECONDS: 60,
  createSessionToken: vi.fn(),
  verifySessionToken: mocks.verifySessionToken,
}));

import { requireAdmin, requireAdminPage } from "@/lib/auth";
import { ADMIN_REQUIRED_ERROR } from "@/lib/roles";

const baseUser = { id: "u1", organizationId: "org", name: "A", email: "a@x.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifySessionToken.mockResolvedValue({ userId: "u1", organizationId: "org" });
});

describe("requireAdmin", () => {
  it("returns the user for admins", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, role: "ADMIN" });
    await expect(requireAdmin()).resolves.toEqual({ user: { ...baseUser, role: "ADMIN" }, error: null });
  });

  it("returns an error for members (role read fresh from the DB)", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, role: "MEMBER" });
    await expect(requireAdmin()).resolves.toEqual({ user: null, error: ADMIN_REQUIRED_ERROR });
  });

  it("redirects to /login when signed out", async () => {
    mocks.verifySessionToken.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("requireAdminPage", () => {
  it("redirects members to /settings", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, role: "MEMBER" });
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/settings");
  });
});
