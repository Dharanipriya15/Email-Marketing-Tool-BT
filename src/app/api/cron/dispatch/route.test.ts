import { beforeEach, describe, expect, it, vi } from "vitest";

const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/campaign-send-service", () => ({ dispatchDueCampaigns: dispatchMock }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/dispatch/route";

const req = (auth?: string) =>
  new NextRequest("http://localhost/api/cron/dispatch", auth ? { headers: { authorization: auth } } : undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret-value");
  vi.stubEnv("EMAIL_SENDING_ENABLED", "true");
  dispatchMock.mockResolvedValue({ started: [], failedToStart: [], processed: [], flaggedStuck: 0, elapsedMs: 1 });
});

describe("cron dispatch route", () => {
  it("rejects missing or wrong secrets", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("dispatches with the right secret", async () => {
    const res = await GET(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when sending is disabled", async () => {
    vi.stubEnv("EMAIL_SENDING_ENABLED", "false");
    const res = await GET(req("Bearer s3cret-value"));
    expect(await res.json()).toMatchObject({ skipped: expect.any(String) });
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
