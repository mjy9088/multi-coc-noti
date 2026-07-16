type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function createRateLimiter({ limit = 120, windowMs = 60_000, now = Date.now }: { limit?: number; windowMs?: number; now?: () => number } = {}): (key: string) => RateLimitResult {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (key: string) => {
    const timestamp = now();
    let bucket = buckets.get(key);
    if (!bucket || timestamp >= bucket.resetAt) {
      bucket = { count: 0, resetAt: timestamp + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) if (timestamp >= value.resetAt) buckets.delete(bucketKey);
    }
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000)),
    };
  };
}
