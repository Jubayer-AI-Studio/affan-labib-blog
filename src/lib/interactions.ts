// src/lib/interactions.ts
// Universal Cloud Interactions Engine (Views, Likes, Comments & Author Replies)
// Equipped with Direct Supabase Cloud Sync and In-Memory/Local Resilience

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

export interface CommentItem {
  id: string;
  slug: string;
  parentId?: string | null;
  authorName: string;
  content: string;
  createdAt: string;
  isAuthor?: boolean;
  replies?: CommentItem[];
}

export interface ArticleStat {
  views: number;
  likes: number;
}

export interface InteractionsStore {
  stats: Record<string, ArticleStat>;
  comments: CommentItem[];
}

let inMemoryStore: InteractionsStore | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 1500; // 1.5s cache for instant cross-edge synchronicity

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBnDigits(n: number | string): string {
  return (n ?? 0).toString().replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function normalizeSlug(s: string): string {
  if (!s) return '';
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

// Canonical Aliases (Bidirectional: English slug and Bengali slug share exact same comments & reactions)
const CANONICAL_SLUG_MAP: Record<string, string> = {
  'takhassuser-jibon-shuru': 'তাখাসসুসের-জীবন-শুরু',
  'তাখাসসুসের-জীবন-শুরু': 'তাখাসসুসের-জীবন-শুরু',
  'dinlipi-shukrobar-amimul-ihsan': 'দিনলিপি-শুক্রবার-ও-মুফতীয়ে-আজম-আমীমুল-ইহসান-রহ-এর-মাকবারা-যিয়ারত',
  'দিনলিপি-শুক্রবার-ও-মুফতীয়ে-আজম-আমীমুল-ইহসান-রহ-এর-মাকবারা-যিয়ারত': 'দিনলিপি-শুক্রবার-ও-মুফতীয়ে-আজম-আমীমুল-ইহসান-রহ-এর-মাকবারা-যিয়ারত',
  'notun-mehman': 'নতুন-মেহমান-ও-বাংলাবাজারের-কিতাব-সফর',
  'নতুন-মেহমান-ও-বাংলাবাজারের-কিতাব-সফর': 'নতুন-মেহমান-ও-বাংলাবাজারের-কিতাব-সফর'
};

export function getCanonicalSlug(rawSlug: string): string {
  const norm = normalizeSlug(rawSlug);
  return CANONICAL_SLUG_MAP[norm] || norm;
}

export function isSameArticleSlug(slugA: string, slugB: string): boolean {
  const normA = normalizeSlug(slugA);
  const normB = normalizeSlug(slugB);
  if (normA === normB) return true;
  const canA = CANONICAL_SLUG_MAP[normA] || normA;
  const canB = CANONICAL_SLUG_MAP[normB] || normB;
  return canA === canB;
}

async function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Interactions request timed out')), ms))
  ]);
}

function normalizeStore(raw: any): InteractionsStore {
  if (!raw || typeof raw !== 'object') {
    return { stats: {}, comments: [] };
  }
  let stats: Record<string, ArticleStat> = {};
  let comments: CommentItem[] = [];

  if (raw.stats && typeof raw.stats === 'object') {
    // Normalize keys in stats
    for (const [key, val] of Object.entries(raw.stats)) {
      const normKey = normalizeSlug(key);
      const s = val as any;
      stats[normKey] = {
        views: typeof s?.views === 'number' ? s.views : 0,
        likes: typeof s?.likes === 'number' ? s.likes : 0
      };
    }
    const rawComments = Array.isArray(raw.comments) ? raw.comments : [];
    comments = rawComments.map((c: any, index: number) => ({
      id: String(c.id || '').trim() || `cmt_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      slug: normalizeSlug(c.slug || ''),
      parentId: c.parentId ? String(c.parentId) : null,
      authorName: String(c.authorName || 'মুগ্ধ পাঠক'),
      content: String(c.content || ''),
      createdAt: String(c.createdAt || new Date().toISOString()),
      isAuthor: Boolean(c.isAuthor),
      replies: []
    }));
  } else {
    // Legacy flat stats map format
    for (const [key, val] of Object.entries(raw)) {
      const normKey = normalizeSlug(key);
      const s = val as any;
      stats[normKey] = {
        views: typeof s?.views === 'number' ? s.views : 0,
        likes: typeof s?.likes === 'number' ? s.likes : 0
      };
    }
    comments = [];
  }

  return { stats, comments };
}

function loadLocalStore(): InteractionsStore {
  try {
    const fs = getFs();
    const p = getLocalPath('src/data/interactions.json');
    if (fs && p && fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(data);
      return normalizeStore(parsed);
    }
  } catch (err) {
    // Cloudflare Edge runtime fallback
  }
  return normalizeStore(staticInteractions);
}

function saveLocalStore(store: InteractionsStore): void {
  try {
    const fs = getFs();
    const p = getLocalPath('src/data/interactions.json');
    if (fs && p) {
      fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf-8');
    }
  } catch {
    // In serverless, filesystem is read-only which is expected
  }
}

async function fetchFromSupabase(): Promise<InteractionsStore | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('posts')
        .select('body')
        .eq('slug', CLOUD_STORE_SLUG)
        .maybeSingle(),
      3500
    );

    if (!error && data && data.body) {
      const parsed = JSON.parse(data.body);
      return normalizeStore(parsed);
    }
  } catch (err: any) {
    console.warn('[Interactions] Supabase fetch warning:', err.message);
  }
  return null;
}

async function saveToSupabase(store: InteractionsStore): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('posts').upsert(
        {
          slug: CLOUD_STORE_SLUG,
          title: 'System Cloud Interactions Store',
          category: 'chinta',
          description: 'Auto-synced reactions, views & comments',
          published_at: '2026-01-01T00:00:00Z',
          formatted_date: '১ জানুয়ারি, ২০২৬',
          tags: [],
          body: JSON.stringify(store),
          word_count: 0,
          footnotes: [],
          updated_at: new Date().toISOString()
        },
        { onConflict: 'slug' }
      ),
      4000
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

async function getStore(): Promise<InteractionsStore> {
  if (inMemoryStore && Date.now() - lastCacheTime < CACHE_TTL_MS) {
    return inMemoryStore;
  }

  // 1. Try Supabase Cloud
  const cloudStore = await fetchFromSupabase();
  if (cloudStore !== null) {
    inMemoryStore = cloudStore;
    lastCacheTime = Date.now();
    saveLocalStore(cloudStore);
    return cloudStore;
  }

  // 2. Fallback to Local/In-Memory
  if (!inMemoryStore) {
    inMemoryStore = loadLocalStore();
  }
  lastCacheTime = Date.now();
  return inMemoryStore;
}

export async function getArticleStats(rawSlug: string): Promise<ArticleStat> {
  const slug = normalizeSlug(rawSlug);
  const store = await getStore();
  let views = store.stats[slug]?.views || 0;
  let likes = store.stats[slug]?.likes || 0;

  // Add stats from aliased slug if separate
  for (const [k, v] of Object.entries(store.stats)) {
    if (k !== slug && isSameArticleSlug(k, slug)) {
      views = Math.max(views, v?.views || 0);
      likes = Math.max(likes, v?.likes || 0);
    }
  }

  return { views, likes };
}

export async function getArticleStatsAndComments(rawSlug: string): Promise<{
  views: number;
  likes: number;
  comments: CommentItem[];
}> {
  const slug = normalizeSlug(rawSlug);
  const store = await getStore();
  const stat = await getArticleStats(slug);

  // Facebook-style matching: any comment on this slug OR aliased slug matches!
  const allComments = (store.comments || []).filter((c) => isSameArticleSlug(c.slug, slug));

  // Build hierarchical replies
  const rootComments: CommentItem[] = [];
  const replyMap = new Map<string, CommentItem[]>();

  for (const c of allComments) {
    if (c.parentId) {
      const arr = replyMap.get(c.parentId) || [];
      arr.push(c);
      replyMap.set(c.parentId, arr);
    } else {
      rootComments.push(c);
    }
  }

  for (const root of rootComments) {
    root.replies = replyMap.get(root.id) || [];
  }

  return {
    views: stat.views,
    likes: stat.likes,
    comments: rootComments
  };
}

export async function incrementView(rawSlug: string): Promise<number> {
  const slug = normalizeSlug(rawSlug);
  const canonical = getCanonicalSlug(slug);
  const store = await getStore();

  if (!store.stats[canonical]) {
    store.stats[canonical] = { views: 0, likes: 0 };
  }
  store.stats[canonical].views += 1;
  const newViews = store.stats[canonical].views;

  // Mirror to raw slug if different
  if (slug !== canonical) {
    store.stats[slug] = { ...store.stats[canonical] };
  }

  inMemoryStore = store;
  lastCacheTime = Date.now();
  saveLocalStore(store);
  saveToSupabase(store).catch(() => {});

  return newViews;
}

export async function toggleLike(rawSlug: string, isLike: boolean): Promise<number> {
  const slug = normalizeSlug(rawSlug);
  const canonical = getCanonicalSlug(slug);
  const store = await getStore();

  if (!store.stats[canonical]) {
    store.stats[canonical] = { views: 0, likes: 0 };
  }
  if (isLike) {
    store.stats[canonical].likes += 1;
  } else {
    store.stats[canonical].likes = Math.max(0, store.stats[canonical].likes - 1);
  }
  const newLikes = store.stats[canonical].likes;

  // Mirror to raw slug if different
  if (slug !== canonical) {
    store.stats[slug] = { ...store.stats[canonical] };
  }

  inMemoryStore = store;
  lastCacheTime = Date.now();
  saveLocalStore(store);
  saveToSupabase(store).catch(() => {});

  return newLikes;
}

export async function addComment(
  rawSlug: string,
  content: string,
  authorName?: string,
  isAuthor = false,
  parentId: string | null = null
): Promise<CommentItem> {
  const slug = normalizeSlug(rawSlug);
  const canonical = getCanonicalSlug(slug);
  const store = await getStore();
  const id = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = (authorName || '').trim() || (isAuthor ? 'আফফান লাবীব (লেখক)' : 'মুগ্ধ পাঠক');
  const now = new Date().toISOString();

  const newComment: CommentItem = {
    id,
    slug: canonical,
    parentId: parentId || null,
    authorName: cleanName,
    content: content.trim(),
    createdAt: now,
    isAuthor,
    replies: []
  };

  if (!store.comments) store.comments = [];
  store.comments.unshift(newComment); // Newest comments first

  inMemoryStore = store;
  lastCacheTime = Date.now();
  saveLocalStore(store);
  await saveToSupabase(store);

  return newComment;
}

export async function deleteComment(targetIdOrContent: string): Promise<boolean> {
  const store = await getStore();
  if (!store.comments || store.comments.length === 0) return false;
  const initialLen = store.comments.length;
  const cleanTarget = String(targetIdOrContent || '').trim();
  if (!cleanTarget) return false;

  // Delete comment and its replies, matching by id or content or parentId
  store.comments = store.comments.filter(
    (c) => c.id !== cleanTarget && c.parentId !== cleanTarget && c.content !== cleanTarget
  );
  const changed = store.comments.length < initialLen;
  if (!changed) return false;

  inMemoryStore = store;
  lastCacheTime = Date.now();
  saveLocalStore(store);
  await saveToSupabase(store);

  return true;
}

export async function getAllInteractionsForAdmin(): Promise<InteractionsStore> {
  return await getStore();
}

export async function getAllStatsForAdmin(): Promise<Record<string, ArticleStat>> {
  const store = await getStore();
  return store.stats;
}
