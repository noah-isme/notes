import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit, extractClientIp } from '$lib/server/rateLimit';

describe('Unit: Rate Limiting Service', () => {
  const TEST_KEY = 'test:rate-limit-ip-1';

  beforeEach(() => {
    resetRateLimit(TEST_KEY);
  });

  it('should allow requests under the maximum limit', () => {
    const result1 = checkRateLimit(TEST_KEY, 3, 60000);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = checkRateLimit(TEST_KEY, 3, 60000);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = checkRateLimit(TEST_KEY, 3, 60000);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should block requests that exceed the maximum limit within window', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit(TEST_KEY, 3, 60000);
    }

    const blocked = checkRateLimit(TEST_KEY, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('should reset limits when resetRateLimit is invoked', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit(TEST_KEY, 3, 60000);
    }

    expect(checkRateLimit(TEST_KEY, 3, 60000).allowed).toBe(false);

    resetRateLimit(TEST_KEY);

    const fresh = checkRateLimit(TEST_KEY, 3, 60000);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(2);
  });

  it('should extract client IP address accurately from headers', () => {
    const reqWithForwarded = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    });
    expect(extractClientIp(reqWithForwarded)).toBe('203.0.113.195');

    const reqWithRealIp = new Request('https://example.com', {
      headers: { 'x-real-ip': '198.51.100.4' },
    });
    expect(extractClientIp(reqWithRealIp)).toBe('198.51.100.4');

    const reqWithGetter = new Request('https://example.com');
    expect(extractClientIp(reqWithGetter, () => '192.0.2.1')).toBe('192.0.2.1');

    const reqDefault = new Request('https://example.com');
    expect(extractClientIp(reqDefault)).toBe('127.0.0.1');
  });
});
