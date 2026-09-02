/**
 * Sliding Window In-Memory Rate Limiter
 * Provides IP/Key-based rate limiting for authentication and sensitive mutation endpoints.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;
  const threshold = now - windowMs;

  for (const [key, record] of store.entries()) {
    const validTimestamps = record.timestamps.filter((t) => t > threshold);
    if (validTimestamps.length === 0) {
      store.delete(key);
    } else {
      record.timestamps = validTimestamps;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  totalHits: number;
}

/**
 * Checks and records a hit against a rate limit key.
 *
 * @param key Unique identifier for the client (e.g. IP address or user ID)
 * @param maxHits Maximum permitted hits within the window (default: 10)
 * @param windowMs Duration of the sliding window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  key: string,
  maxHits = 10,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  purgeStaleEntries(windowMs);

  const threshold = now - windowMs;
  let record = store.get(key);

  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter timestamps within the current window
  record.timestamps = record.timestamps.filter((t) => t > threshold);

  if (record.timestamps.length >= maxHits) {
    const oldestInWindow = record.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      totalHits: record.timestamps.length,
    };
  }

  // Record this hit
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxHits - record.timestamps.length,
    retryAfterSec: 0,
    totalHits: record.timestamps.length,
  };
}

/**
 * Helper to extract client IP address safely from Request or event.
 */
export function extractClientIp(
  request: Request,
  getClientAddress?: () => string
): string {
  if (getClientAddress) {
    try {
      const addr = getClientAddress();
      if (addr) return addr;
    } catch {}
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return '127.0.0.1';
}

/**
 * Resets the rate limit for a specific key (useful for tests or after successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
