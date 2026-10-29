// src/lib/interactions.ts
// Universal Cloud Interactions Engine (Views & Likes Only)
// Direct Supabase Cloud Sync with In-Memory and Local Resilience

import { supabase, isSupabaseConfigured } from './supabase.ts';
import staticInteractions from '../data/interactions.json';

let _fs: any = null;
function getFs(): any {
  if (typeof process === 'undefined' || (process.env && process.env.CF_PAGES)) return null;
  if (_fs) return _fs;
  try {
    const r = (globalThis as any).require;
    if (typeof r === 'function') _fs = r('fs');
  } catch {}
  return _fs;
}

function getLocalPath(rel: string): string {
  try {
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      const r = (globalThis as any).require;
      const p = typeof r === 'function' ? r('path') : null;
      if (p && p.resolve) return p.resolve(process.cwd(), rel);
    }
  } catch {}
  return '';
}
const CLOUD_STORE_SLUG = '__interactions_store__';

export interface ArticleStat {
  views: number;
  likes: number;
}

type StatsMap = Record<string, ArticleStat>;

let inMemoryStats: StatsMap | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2000; // 2s cache // 5s cache

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBnDigits(n: number | string): string {
  return (n ?? 0).toString().replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

function loadLocalStore(): StatsMap {
  try {
    const fs = getFs(); const p = getLocalPath('src/data/interactions.json');
    if (fs && p && fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.stats || parsed || {};
    }
  } catch (err) {
    // Cloudflare Edge runtime fallback
  }
  return (staticInteractions as any)?.stats || {};
}

function saveLocalStore(stats: StatsMap): void {
  try {
    const fs = getFs(); const p = getLocalPath('src/data/interactions.json'); if (fs && p) { fs.writeFileSync(p, JSON.stringify({ stats }, null, 2), 'utf-8'); }
  } catch {
    // In serverless, filesystem is read-only which is expected
  }
}

async function fetchFromSupabase(): Promise<StatsMap | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('body')
      .eq('slug', CLOUD_STORE_SLUG)
      .maybeSingle();

    if (!error && data && data.body) {
      const parsed = JSON.parse(data.body);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch (err) {
    console.warn('[Interactions] Supabase fetch warning:', err);
  }
  return null;
}

async function saveToSupabase(stats: StatsMap): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.from('posts').upsert(
      {
        slug: CLOUD_STORE_SLUG,
        title: 'System Cloud Interactions Store',
        category: 'chinta',
        description: 'Auto-synced reactions & views',
        published_at: '2026-01-01T00:00:00Z',
        formatted_date: '১ জানুয়ারি, ২০২৬',
        tags: [],
        body: JSON.stringify(stats),
        word_count: 0,
        footnotes: [],
        updated_at: new Date().toISOString()
      },
      { onConflict: 'slug' }
    );
    if (error) {
      console.error('[Interactions] Supabase upsert error:', error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Interactions] Supabase save exception:', err.message);
    return false;
  }
}

async function getStatsMap(): Promise<StatsMap> {
  if (inMemoryStats && Date.now() - lastCacheTime < CACHE_TTL_MS) {
    return inMemoryStats;
  }

  // 1. Try Supabase Cloud
  const cloudStats = await fetchFromSupabase();
  if (cloudStats !== null) {
    inMemoryStats = cloudStats;
    lastCacheTime = Date.now();
    saveLocalStore(cloudStats);
    return cloudStats;
  }

  // 2. Fallback to Local/In-Memory
  if (!inMemoryStats) {
    inMemoryStats = loadLocalStore();
  }
  lastCacheTime = Date.now();
  return inMemoryStats;
}

export async function getArticleStats(slug: string): Promise<ArticleStat> {
  const map = await getStatsMap();
  return map[slug] || { views: 0, likes: 0 };
}

export async function incrementView(slug: string): Promise<number> {
  const map = await getStatsMap();
  if (!map[slug]) {
    map[slug] = { views: 0, likes: 0 };
  }
  map[slug].views += 1;
  const newViews = map[slug].views;

  // Persist immediately to Cloud & Local
  inMemoryStats = map;
  lastCacheTime = Date.now();
  saveLocalStore(map);
  await saveToSupabase(map);

  return newViews;
}

export async function toggleLike(slug: string, isLike: boolean): Promise<number> {
  const map = await getStatsMap();
  if (!map[slug]) {
    map[slug] = { views: 0, likes: 0 };
  }
  if (isLike) {
    map[slug].likes += 1;
  } else {
    map[slug].likes = Math.max(0, map[slug].likes - 1);
  }
  const newLikes = map[slug].likes;

  // Persist immediately to Cloud & Local
  inMemoryStats = map;
  lastCacheTime = Date.now();
  saveLocalStore(map);
  await saveToSupabase(map);

  return newLikes;
}

export async function getAllStatsForAdmin(): Promise<StatsMap> {
  return await getStatsMap();
}
