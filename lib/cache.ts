interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * Simple in-memory cache with TTL support.
 * Persists across requests within the same server instance.
 * Uses globalThis pattern (like Prisma singleton) to survive dev hot reloads.
 */
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }
}

const globalForCache = globalThis as unknown as {
  memoryCache: MemoryCache | undefined
}

export const memoryCache = globalForCache.memoryCache ?? new MemoryCache()

if (process.env.NODE_ENV !== 'production') globalForCache.memoryCache = memoryCache
