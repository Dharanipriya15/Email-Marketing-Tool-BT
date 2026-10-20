import { describe, expect, it, vi } from "vitest";
import { isTransientDbError, withDbRetry } from "@/lib/db-retry";

const noSleep = () => Promise.resolve();

describe("isTransientDbError", () => {
  it("detects connection codes and messages", () => {
    expect(isTransientDbError({ code: "P1001" })).toBe(true);
    expect(isTransientDbError({ code: "P1017" })).toBe(true);
    expect(isTransientDbError(new Error("Server has closed the connection."))).toBe(true);
  });
  it("ignores other errors", () => {
    expect(isTransientDbError({ code: "P2002" })).toBe(false);
    expect(isTransientDbError(new Error("Unique constraint failed"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe("withDbRetry", () => {
  it("retries transient errors with backoff then succeeds", async () => {
    const sleep = vi.fn((ms: number) => noSleep().then(() => void ms));
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server has closed the connection."))
      .mockRejectedValueOnce({ code: "P1001", message: "Can't reach database server" })
      .mockResolvedValue("ok");
    await expect(withDbRetry(op, { sleep, baseDelayMs: 100 })).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });
  it("does not retry non-transient errors", async () => {
    const op = vi.fn().mockRejectedValue({ code: "P2002", message: "Unique" });
    await expect(withDbRetry(op, { sleep: noSleep })).rejects.toMatchObject({ code: "P2002" });
    expect(op).toHaveBeenCalledTimes(1);
  });
  it("gives up after the retry limit", async () => {
    const op = vi.fn().mockRejectedValue({ code: "P1017", message: "closed" });
    await expect(withDbRetry(op, { sleep: noSleep, retries: 2 })).rejects.toMatchObject({ code: "P1017" });
    expect(op).toHaveBeenCalledTimes(3);
  });
});
