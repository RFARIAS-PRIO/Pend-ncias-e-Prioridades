const buckets = new Map<string, number[]>();
/** Janela deslizante em memória. Para múltiplas instâncias, trocar por Redis. */
export function rateLimit(key: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) }; }
  arr.push(now); buckets.set(key, arr);
  return { ok: true, retryAfter: 0 };
}
