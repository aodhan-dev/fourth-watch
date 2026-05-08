export const KILL_SWITCH = 1;
export const MAX_RUNTIME_ENTRIES = 50;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ActivateOptions {
  cacheKeys: string[];
  appCacheName: string;
  killSwitchCacheName: string;
  deleteCache: (name: string) => Promise<boolean>;
  openCache: (name: string) => Promise<unknown>;
  unregister: () => Promise<boolean>;
  claim: () => Promise<void>;
}

export async function runActivate(opts: ActivateOptions): Promise<void> {
  const {
    cacheKeys,
    appCacheName,
    killSwitchCacheName,
    deleteCache,
    openCache,
    unregister,
    claim
  } = opts;
  const hasKillSwitch = cacheKeys.includes(killSwitchCacheName);
  const hasAppCaches = cacheKeys.some((k) => k.startsWith('cache-'));

  if (!hasKillSwitch && hasAppCaches) {
    for (const key of cacheKeys) await deleteCache(key);
    await unregister();
    return;
  }
  if (!hasKillSwitch) {
    await openCache(killSwitchCacheName);
  }
  for (const key of cacheKeys) {
    if (key !== appCacheName && key !== killSwitchCacheName) await deleteCache(key);
  }
  await claim();
}

export class LRUCache {
  private order: string[] = [];

  constructor(private max: number) {}

  put(url: string, evict: (url: string) => void): void {
    const idx = this.order.indexOf(url);
    if (idx !== -1) this.order.splice(idx, 1);
    this.order.push(url);
    if (this.order.length > this.max) {
      const oldest = this.order.shift()!;
      evict(oldest);
    }
  }

  size(): number {
    return this.order.length;
  }

  oldest(): string | undefined {
    return this.order[0];
  }
}

interface Puttable {
  put(req: unknown, res: unknown): Promise<void>;
}

export async function safeCachePut(cache: Puttable, req: unknown, res: unknown): Promise<void> {
  try {
    await cache.put(req, res);
  } catch (e) {
    console.debug('[SW] cache.put failed:', e);
  }
}
