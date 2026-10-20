// Simple in-memory fixed-window rate limiter. Single-instance only — good
// enough for Phase 1's internal deployment; revisit if the app is ever
// horizontally scaled behind a load balancer.

const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

type RateLimitOptions = {
  maxAttempts?: number;
  windowMs?: number;
};

export function checkRateLimit(
  key: string,
  { maxAttempts = MAX_ATTEMPTS, windowMs = WINDOW_MS }: RateLimitOptions = {}
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true };
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
