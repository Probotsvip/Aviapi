// Ultra-fast in-memory cache for frequently requested songs
interface CacheItem {
  title: string;
  downloadUrl: string;
  format: string;
  duration: string;
  timestamp: number;
}

class FastCache {
  private cache: Map<string, CacheItem> = new Map();
  private maxSize = 1000; // Store up to 1000 popular songs
  private ttl = 24 * 60 * 60 * 1000; // 24 hours TTL

  set(videoId: string, format: string, data: CacheItem): void {
    const key = `${videoId}_${format}`;
    
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { ...data, timestamp: Date.now() });
  }

  get(videoId: string, format: string): CacheItem | null {
    const key = `${videoId}_${format}`;
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item;
  }

  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }

  clear(): void {
    this.cache.clear();
  }
}

export const fastCache = new FastCache();