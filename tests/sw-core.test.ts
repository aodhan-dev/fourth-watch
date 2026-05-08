import { describe, it, expect, vi } from 'vitest';
import { KILL_SWITCH, runActivate, LRUCache, safeCachePut } from '../src/lib/sw-core';

const KS = `ks-${KILL_SWITCH}`;

describe('runActivate – kill switch', () => {
  it('unregisters and clears all caches when kill-switch version is absent but old app caches exist', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    const unregister = vi.fn().mockResolvedValue(true);
    const claim = vi.fn();

    await runActivate({
      cacheKeys: ['cache-old-version', `ks-${KILL_SWITCH - 1}`],
      appCacheName: 'cache-new-version',
      killSwitchCacheName: KS,
      deleteCache,
      openCache: vi.fn(),
      unregister,
      claim
    });

    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith('cache-old-version');
    expect(deleteCache).toHaveBeenCalledWith(`ks-${KILL_SWITCH - 1}`);
    expect(claim).not.toHaveBeenCalled();
  });

  it('does not unregister on fresh install (no prior app caches)', async () => {
    const unregister = vi.fn();
    const openCache = vi.fn().mockResolvedValue({});
    const claim = vi.fn().mockResolvedValue(undefined);

    await runActivate({
      cacheKeys: [],
      appCacheName: 'cache-v1',
      killSwitchCacheName: KS,
      deleteCache: vi.fn(),
      openCache,
      unregister,
      claim
    });

    expect(unregister).not.toHaveBeenCalled();
    expect(openCache).toHaveBeenCalledWith(KS);
    expect(claim).toHaveBeenCalled();
  });

  it('cleans up stale app caches on normal upgrade (kill switch intact)', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    const claim = vi.fn().mockResolvedValue(undefined);
    const unregister = vi.fn();

    await runActivate({
      cacheKeys: ['cache-old', KS, 'runtime-old'],
      appCacheName: 'cache-new',
      killSwitchCacheName: KS,
      deleteCache,
      openCache: vi.fn(),
      unregister,
      claim
    });

    expect(unregister).not.toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledWith('cache-old');
    expect(deleteCache).toHaveBeenCalledWith('runtime-old');
    expect(deleteCache).not.toHaveBeenCalledWith(KS);
    expect(deleteCache).not.toHaveBeenCalledWith('cache-new');
    expect(claim).toHaveBeenCalled();
  });
});

describe('LRUCache', () => {
  it('evicts oldest entry when capacity is exceeded', () => {
    const cache = new LRUCache(3);
    const evicted: string[] = [];
    const ev = (u: string) => evicted.push(u);

    cache.put('a', ev);
    cache.put('b', ev);
    cache.put('c', ev);
    cache.put('d', ev);

    expect(evicted).toEqual(['a']);
    expect(cache.size()).toBe(3);
    expect(cache.oldest()).toBe('b');
  });

  it('does not evict while under capacity', () => {
    const cache = new LRUCache(5);
    const evicted: string[] = [];
    cache.put('x', (u) => evicted.push(u));
    cache.put('y', (u) => evicted.push(u));
    expect(evicted).toHaveLength(0);
    expect(cache.size()).toBe(2);
  });

  it('re-access moves url to end, protecting it from eviction', () => {
    const cache = new LRUCache(3);
    const evicted: string[] = [];
    const ev = (u: string) => evicted.push(u);

    cache.put('a', ev);
    cache.put('b', ev);
    cache.put('c', ev);
    cache.put('a', ev); // re-access a → b becomes oldest
    cache.put('d', ev); // should evict b

    expect(evicted).toEqual(['b']);
    expect(cache.oldest()).toBe('c');
  });
});

describe('safeCachePut', () => {
  it('swallows cache.put rejections without rethrowing', async () => {
    const cache = { put: vi.fn().mockRejectedValue(new Error('QuotaExceededError')) };
    await expect(safeCachePut(cache, 'req', 'res')).resolves.toBeUndefined();
  });

  it('resolves normally when cache.put succeeds', async () => {
    const cache = { put: vi.fn().mockResolvedValue(undefined) };
    await expect(safeCachePut(cache, 'req', 'res')).resolves.toBeUndefined();
    expect(cache.put).toHaveBeenCalledWith('req', 'res');
  });
});
