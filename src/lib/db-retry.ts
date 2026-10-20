// Retry helper for transient database connection failures (e.g. the Supabase
// pooler dropping a connection mid-send). Only connection-level errors are
// retried; constraint/validation errors are rethrown immediately.

const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);
const TRANSIENT_MESSAGES = [
  "server has closed the connection",
  "can't reach database server",
  "connection reset",
  "connection terminated",
  "econnreset",
  "etimedout",
  "timed out fetching a new connection",
];

export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true;
  const name = (error as { name?: unknown }).name;
  if (name === "PrismaClientInitializationError") return true;
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return TRANSIENT_MESSAGES.some((needle) => message.includes(needle));
}

export type DbRetryOptions = {
  retries?: number; // extra attempts after the first (default 4)
  baseDelayMs?: number; // first backoff delay, doubled each attempt (default 500)
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withDbRetry<T>(operation: () => Promise<T>, options: DbRetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !isTransientDbError(error)) throw error;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      console.warn("[db-retry] transient database error, retrying", { attempt: attempt + 1, delay });
      await sleep(delay);
    }
  }
}
