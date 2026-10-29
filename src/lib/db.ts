// src/lib/db.ts
// Universal Cloud Database Engine with Supabase & GitHub Sync

import { supabase, isSupabaseConfigured } from './supabase.ts';
import { syncPostsToGitHub } from './githubSync.ts';
import staticPosts from '../data/posts.json';
import staticAuthor from '../data/author.json';
import staticBookshelf from '../data/bookshelf.json';
import staticCategories from '../data/categories.json';

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

export interface Category {
  id: string;
  title: string;
  desc: string;
  icon?: string;
}

export interface Post {
  slug: string;
  title: string;
  category: string;
  description: string;
  publishedAt: string;
  formattedDate: string;
  tags: string[];
  body: string;
  wordCount?: number;
  footnotes?: Array<{ id: number; text: string }>;
  pinned?: boolean;
}

export interface AuthorProfile {
  name: string;
  tagline: string;
  education: string;
  bioShort: string;
  bioFull: string;
  avatar: string;
  aboutManifestoTitle?: string;
  aboutManifesto?: string;
  social: {
    facebook?: string;
    whatsapp?: string;
    whatsappNumber?: string;
    email?: string;
  };
}

// In-memory runtime cache for serverless instances
let inMemoryPostsCache: Post[] | null = null;
let lastPostsCacheTime = 0;
let inMemoryCategoriesCache: Category[] | null = null;
let lastCategoriesCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

export function getLocalPosts(): Post[] {
  let list: any[] = [];
  try {
    const fs = getFs(); const p = getLocalPath('src/data/posts.json');
    if (fs && p && fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      list = JSON.parse(data);
    }
  } catch (err) {
    // Cloudflare Edge runtime fallback
  }
  if (!Array.isArray(list) || list.length === 0) {
    list = Array.isArray(staticPosts) ? (staticPosts as any[]) : [];
  }
  const mapped = list
    .filter((p: any) => !p.slug?.startsWith('__'))
    .map((p: any) => ({
      ...p,
      pinned: p.pinned === true || (Array.isArray(p.tags) && p.tags.includes('__pinned__')),
      tags: Array.isArray(p.tags) ? p.tags.filter((t: string) => !t.startsWith('__')) : []
    }));

  mapped.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  return mapped;
}

async function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('DB query timeout')), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}

export async function getAllPostsAsync(): Promise<Post[]> {
  // 1. High-speed in-memory cache check (0.1ms instant resolution)
  if (inMemoryPostsCache && inMemoryPostsCache.length > 0 && Date.now() - lastPostsCacheTime < CACHE_TTL_MS) {
    return [...inMemoryPostsCache];
  }

  // 2. Try Supabase if configured (guarded by 4s timeout for cross-region latency)
  if (isSupabaseConfigured && supabase) {
    try {
      const query = supabase
        .from('posts')
        .select('*')
        .order('published_at', { ascending: false });
      const { data, error } = await withTimeout(query, 4000);

      if (!error && data && data.length > 0) {
        const filteredRows = data.filter((row: any) => !row.slug?.startsWith('__'));
        const mapped: Post[] = filteredRows.map((row: any) => {
          const rawTags = Array.isArray(row.tags) ? row.tags : [];
          const isPinned = rawTags.includes('__pinned__') || row.pinned === true;
          return {
            slug: row.slug,
            title: row.title,
            category: row.category,
            description: row.description || '',
            publishedAt: row.published_at,
            formattedDate: row.formatted_date || row.published_at,
            tags: rawTags.filter((t: string) => !t.startsWith('__')),
            body: row.body || '',
            wordCount: row.word_count || 0,
            footnotes: Array.isArray(row.footnotes) ? row.footnotes : [],
            pinned: isPinned
          };
        });

        mapped.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });

        inMemoryPostsCache = mapped;
        lastPostsCacheTime = Date.now();
        return [...mapped];
      }
    } catch (e: any) {
      console.warn('[DB] Supabase query failed or timed out, falling back to local:', e.message);
    }
  }

  // 3. Return in-memory cache if available
  if (inMemoryPostsCache && inMemoryPostsCache.length > 0) {
    return [...inMemoryPostsCache];
  }

  // 4. Fallback to local posts.json
  const local = getLocalPosts();
  inMemoryPostsCache = local;
  lastPostsCacheTime = Date.now();
  return [...local];
}

// Synchronous version for Astro SSG build steps
export function getAllPosts(): Post[] {
  if (inMemoryPostsCache && inMemoryPostsCache.length > 0) {
    return [...inMemoryPostsCache];
  }
  const local = getLocalPosts();
  inMemoryPostsCache = local;
  return [...local];
}

function saveLocalPosts(list: Post[]): void {
  try {
    const fs = getFs();
    const p = getLocalPath('src/data/posts.json');
    if (fs && p) {
      fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
    }
  } catch {}
}

function saveLocalCategories(list: Category[]): void {
  try {
    const fs = getFs();
    const p = getLocalPath('src/data/categories.json');
    if (fs && p) {
      fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
    }
  } catch {}
}

export async function savePost(newPost: Post): Promise<boolean> {
  try {
    // 1. Update in-memory cache immediately
    const current = await getAllPostsAsync();
    const existingIndex = current.findIndex((p) => p.slug === newPost.slug);
    if (existingIndex >= 0) {
      current[existingIndex] = newPost;
    } else {
      current.unshift(newPost);
    }
    inMemoryPostsCache = current;
    lastPostsCacheTime = Date.now();

    // 2. Try Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('posts').upsert(
          {
            slug: newPost.slug,
            title: newPost.title,
            category: newPost.category,
            description: newPost.description,
            published_at: newPost.publishedAt,
            formatted_date: newPost.formattedDate,
            tags: (() => {
              const clean = (newPost.tags || []).filter((t: string) => !t.startsWith('__'));
              if (newPost.pinned) clean.push('__pinned__');
              return clean;
            })(),
            body: newPost.body,
            word_count: newPost.wordCount || 0,
            footnotes: newPost.footnotes || [],
            updated_at: new Date().toISOString()
          },
          { onConflict: 'slug' }
        );
        if (error) {
          console.error('[DB] Supabase save error:', error);
        }
      } catch (err) {
        console.error('[DB] Supabase exception:', err);
      }
    }

    // 3. Write to local file if writable (e.g. dev/local environment)
    saveLocalPosts(current);

    // 4. Trigger GitHub background sync so repo stays updated forever
    syncPostsToGitHub(current).catch((e) =>
      console.warn('[DB] GitHub background sync warning:', e)
    );

    return true;
  } catch (err) {
    console.error('[DB] Error saving post:', err);
    return false;
  }
}

export async function togglePostPin(slug: string): Promise<boolean> {
  const current = await getAllPostsAsync();
  const post = current.find((p) => p.slug === slug);
  if (!post) return false;
  post.pinned = !post.pinned;
  await savePost(post);
  return post.pinned;
}

export async function deletePostBySlug(slug: string): Promise<boolean> {
  try {
    const current = await getAllPostsAsync();
    const filtered = current.filter((p) => p.slug !== slug);
    if (filtered.length === current.length) return false;

    inMemoryPostsCache = filtered;
    lastPostsCacheTime = Date.now();

    // 1. Delete from Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('posts').delete().eq('slug', slug);
      } catch (e) {
        console.error('[DB] Supabase delete error:', e);
      }
    }

    // 2. Delete from local if writable
    saveLocalPosts(filtered);

    // 3. Trigger GitHub background sync
    syncPostsToGitHub(filtered).catch(() => {});

    return true;
  } catch (err) {
    console.error('[DB] Error deleting post:', err);
    return false;
  }
}

const CLOUD_AUTHOR_SLUG = '__author_store__';
let inMemoryAuthorCache: AuthorProfile | null = null;
let lastAuthorCacheTime = 0;

export function getLocalAuthor(): AuthorProfile {
  try {
    const fs = getFs();
    const p = getLocalPath('src/data/author.json');
    if (fs && p && fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {}
  return staticAuthor as AuthorProfile;
}

export function saveLocalAuthor(author: AuthorProfile): void {
  try {
    const fs = getFs();
    const p = getLocalPath('src/data/author.json');
    if (fs && p) {
      fs.writeFileSync(p, JSON.stringify(author, null, 2), 'utf-8');
    }
  } catch {}
}

export async function getAuthorAsync(): Promise<AuthorProfile> {
  if (inMemoryAuthorCache && Date.now() - lastAuthorCacheTime < CACHE_TTL_MS) {
    return { ...inMemoryAuthorCache };
  }

  // 1. Try Supabase cloud store (__author_store__)
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('posts')
          .select('body')
          .eq('slug', CLOUD_AUTHOR_SLUG)
          .maybeSingle(),
        3500
      );

      if (!error && data && data.body) {
        const parsed = JSON.parse(data.body);
        if (parsed && typeof parsed === 'object' && parsed.name) {
          const merged: AuthorProfile = {
            ...staticAuthor,
            ...parsed,
            social: {
              ...(staticAuthor as any).social,
              ...(parsed.social || {})
            }
          };
          inMemoryAuthorCache = merged;
          lastAuthorCacheTime = Date.now();
          saveLocalAuthor(merged);
          return { ...merged };
        }
      }
    } catch (e: any) {
      console.warn('[DB] Supabase author query failed:', e.message);
    }
  }

  if (inMemoryAuthorCache) {
    return { ...inMemoryAuthorCache };
  }

  const local = getLocalAuthor();
  inMemoryAuthorCache = local;
  lastAuthorCacheTime = Date.now();
  return { ...local };
}

export function getAuthor(): AuthorProfile {
  if (inMemoryAuthorCache) return { ...inMemoryAuthorCache };
  return getLocalAuthor();
}

export async function saveAuthorAsync(updated: Partial<AuthorProfile>): Promise<AuthorProfile> {
  const current = await getAuthorAsync();
  const merged: AuthorProfile = {
    ...current,
    ...updated,
    social: {
      ...current.social,
      ...(updated.social || {})
    }
  };

  inMemoryAuthorCache = merged;
  lastAuthorCacheTime = Date.now();
  saveLocalAuthor(merged);

  if (isSupabaseConfigured && supabase) {
    try {
      await withTimeout(supabase.from('posts').upsert(
        {
          slug: CLOUD_AUTHOR_SLUG,
          title: 'System Cloud Author Profile Store',
          category: 'chinta',
          description: 'Auto-synced author profile & bio',
          published_at: '2026-01-01T00:00:00Z',
          formatted_date: '১ জানুয়ারি, ২০২৬',
          tags: [],
          body: JSON.stringify(merged),
          word_count: 0,
          footnotes: [],
          updated_at: new Date().toISOString()
        },
        { onConflict: 'slug' }
      ), 4000);
    } catch (err) {
      console.error('[DB] Supabase author save error:', err);
    }
  }

  return { ...merged };
}

export async function updateAuthorAvatarAsync(avatarDataUrl: string): Promise<boolean> {
  try {
    await saveAuthorAsync({ avatar: avatarDataUrl });
    return true;
  } catch (err) {
    console.error('[DB] Error updating author avatar:', err);
    return false;
  }
}

export function updateAuthorAvatar(avatarDataUrl: string): boolean {
  updateAuthorAvatarAsync(avatarDataUrl).catch(() => {});
  return true;
}

const CLOUD_CATEGORIES_SLUG = '__categories_store__';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'chinta', title: 'চিন্তা', desc: 'সরল মনন, জীবন ও দৈনন্দিন ভাবনার নানা প্রসঙ্গ', icon: '💭' },
  { id: 'pathalap', title: 'পাঠালাপ', desc: 'বই পড়তে পড়তে জেগে ওঠা চিন্তা ও আলাপচারিতা', icon: '📖' },
  { id: 'itihas', title: 'ইতিহাস', desc: 'অতীত ঐতিহ্য, মনীষী জীবন ও ইতিহাসের গভীর অনুসন্ধান', icon: '🏛️' },
  { id: 'boi-alochona', title: 'বই-আলোচনা', desc: 'পঠিত প্রিয় বইগুলোর ব্যক্তিগত পর্যালোচনা ও পাঠপ্রতিক্রিয়া', icon: '📚' },
  { id: 'onubad', title: 'অনুবাদ', desc: 'আরবি ও অন্যান্য ভাষার ধ্রুপদী ও সমকালীন সাহিত্যের অনুবাদ', icon: '🌐' },
  { id: 'dinlipi', title: 'দিনলিপি', desc: 'ব্যক্তিগত দিনলিপি, দিনযাপনের টুকরো ভাবনা ও অনুভূতি', icon: '📔' },
  { id: 'smritikotha', title: 'স্মৃতিকথা', desc: 'স্মৃতিচারণ, ফেলে আসা দিন ও স্মৃতির পাতা থেকে', icon: '🕰️' },
  { id: 'bhromongatha', title: 'ভ্রমণগাঁথা', desc: 'ভ্রমণবৃত্তান্ত, পথচলার অভিজ্ঞতা ও দেশ-বিদেশের স্মৃতি', icon: '🧭' },
  { id: 'goddo', title: 'গদ্য', desc: 'অনবদ্য সাহিত্যিক গদ্য, মননশীল প্রবন্ধ ও মুক্তচিন্তা', icon: '✍️' }
];

export const CATEGORY_LABELS_MAP: Record<string, string> = {
  chinta: 'চিন্তা',
  pathalap: 'পাঠালাপ',
  itihas: 'ইতিহাস',
  'boi-alochona': 'বই-আলোচনা',
  onubad: 'অনুবাদ',
  dinlipi: 'দিনলিপি',
  smritikotha: 'স্মৃতিকথা',
  bhromongatha: 'ভ্রমণগাঁথা',
  goddo: 'গদ্য'
};

export function getCategoryLabel(id: string): string {
  return CATEGORY_LABELS_MAP[id] || id;
}

export function getLocalCategories(): Category[] {
  try {
    const fs = getFs(); const p = getLocalPath('src/data/categories.json');
    if (fs && p && fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    // Cloudflare Edge runtime fallback
  }
  return Array.isArray(staticCategories) && staticCategories.length > 0 ? (staticCategories as Category[]) : DEFAULT_CATEGORIES;
}

export async function getCategoriesAsync(): Promise<Category[]> {
  // 1. High-speed in-memory cache check (0.1ms instant resolution)
  if (inMemoryCategoriesCache && inMemoryCategoriesCache.length > 0 && Date.now() - lastCategoriesCacheTime < CACHE_TTL_MS) {
    return [...inMemoryCategoriesCache];
  }

  // 2. Try Supabase cloud categories store (__categories_store__)
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('body')
        .eq('slug', CLOUD_CATEGORIES_SLUG)
        .maybeSingle();

      if (!error && data && data.body) {
        const parsed = JSON.parse(data.body);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((c: any) => c.id));
          const merged = [...parsed];
          for (const def of DEFAULT_CATEGORIES) {
            if (!existingIds.has(def.id)) {
              merged.push(def);
            }
          }
          inMemoryCategoriesCache = merged;
          lastCategoriesCacheTime = Date.now();
          saveLocalCategories(merged);
          return [...merged];
        }
      }
    } catch (e: any) {
      // Fallback smoothly
    }
  }

  // 3. Return in-memory cache if available
  if (inMemoryCategoriesCache && inMemoryCategoriesCache.length > 0) {
    return [...inMemoryCategoriesCache];
  }

  // 4. Fallback to local categories.json
  const local = getLocalCategories();
  inMemoryCategoriesCache = local;
  lastCategoriesCacheTime = Date.now();
  return [...local];
}

export function getAllCategories(): Category[] {
  if (inMemoryCategoriesCache && inMemoryCategoriesCache.length > 0) {
    return [...inMemoryCategoriesCache];
  }
  const local = getLocalCategories();
  inMemoryCategoriesCache = local;
  return [...local];
}

export async function saveCategory(newCat: Category): Promise<boolean> {
  try {
    if (!newCat.title) return false;
    let cleanId = (newCat.id || '').toLowerCase().trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!cleanId) {
      cleanId = 'cat-' + Date.now().toString(36);
    }
    const categoryToSave: Category = {
      id: cleanId,
      title: newCat.title.trim(),
      desc: (newCat.desc || '').trim(),
      icon: newCat.icon || '📁'
    };

    const current = await getCategoriesAsync();
    const idx = current.findIndex((c) => c.id === cleanId);
    if (idx >= 0) {
      current[idx] = categoryToSave;
    } else {
      current.push(categoryToSave);
    }
    inMemoryCategoriesCache = current;
    lastCategoriesCacheTime = Date.now();

    saveLocalCategories(current);

    // Persist permanently to Supabase Cloud store in posts table
    if (isSupabaseConfigured && supabase) {
      try {
        await withTimeout(supabase.from('posts').upsert(
          {
            slug: CLOUD_CATEGORIES_SLUG,
            title: 'System Cloud Categories Store',
            category: 'chinta',
            description: 'Auto-synced categories store',
            published_at: '2026-01-01T00:00:00Z',
            formatted_date: '১ জানুয়ারি, ২০২৬',
            tags: [],
            body: JSON.stringify(current),
            word_count: 0,
            footnotes: [],
            updated_at: new Date().toISOString()
          },
          { onConflict: 'slug' }
        ), 4000);
      } catch (err) {
        console.error('[DB] Supabase categories save error:', err);
      }
    }

    return true;
  } catch (err) {
    console.error('[DB] Error saving category:', err);
    return false;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const coreIds = ['chinta', 'pathalap', 'itihas', 'boi-alochona', 'onubad', 'dinlipi', 'smritikotha', 'bhromongatha', 'goddo'];
    if (coreIds.includes(id)) {
      return false; // protect core baseline categories
    }

    const current = await getCategoriesAsync();
    const filtered = current.filter((c) => c.id !== id);
    if (filtered.length === current.length) return false;

    inMemoryCategoriesCache = filtered;
    lastCategoriesCacheTime = Date.now();
    saveLocalCategories(filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await withTimeout(supabase.from('posts').upsert(
          {
            slug: CLOUD_CATEGORIES_SLUG,
            title: 'System Cloud Categories Store',
            category: 'chinta',
            description: 'Auto-synced categories store',
            published_at: '2026-01-01T00:00:00Z',
            formatted_date: '১ জানুয়ারি, ২০২৬',
            tags: [],
            body: JSON.stringify(filtered),
            word_count: 0,
            footnotes: [],
            updated_at: new Date().toISOString()
          },
          { onConflict: 'slug' }
        ), 4000);
      } catch (e) {}
    }

    return true;
  } catch (err) {
    console.error('[DB] Error deleting category:', err);
    return false;
  }
}


// ========================================================
// 🔐 Universal Cloud Admin Security & PIN Store Engine
// ========================================================
export const CLOUD_SECURITY_SLUG = '__admin_security_store__';
export const DEFAULT_ADMIN_PIN = '786992';

const BN_TO_EN_DIGIT_MAP: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

export function normalizeDigits(str: string): string {
  if (!str) return '';
  return str.toString().replace(/[০-৯]/g, (d) => BN_TO_EN_DIGIT_MAP[d] || d).trim();
}

let inMemoryAdminPin: string | null = null;
let lastAdminPinCacheTime = 0;

export async function getAdminPinAsync(): Promise<string> {
  if (inMemoryAdminPin && Date.now() - lastAdminPinCacheTime < CACHE_TTL_MS) {
    return inMemoryAdminPin;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('posts')
          .select('body')
          .eq('slug', CLOUD_SECURITY_SLUG)
          .maybeSingle(),
        3500
      );
      if (!error && data && data.body) {
        const parsed = JSON.parse(data.body);
        if (parsed && parsed.pin) {
          const cleanPin = normalizeDigits(parsed.pin);
          inMemoryAdminPin = cleanPin;
          lastAdminPinCacheTime = Date.now();
          return cleanPin;
        }
      }
    } catch (e: any) {
      console.warn('[DB] Supabase admin pin query failed:', e.message);
    }
  }

  if (inMemoryAdminPin) return inMemoryAdminPin;
  return DEFAULT_ADMIN_PIN;
}

export async function setAdminPinAsync(rawNewPin: string): Promise<boolean> {
  const newPin = normalizeDigits(rawNewPin);
  if (!newPin || newPin.length < 4) {
    throw new Error('পিন কোড কমপক্ষে ৪ ডিজিটের হতে হবে।');
  }

  inMemoryAdminPin = newPin;
  lastAdminPinCacheTime = Date.now();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await withTimeout(
        supabase.from('posts').upsert(
          {
            slug: CLOUD_SECURITY_SLUG,
            title: 'System Admin Security Store',
            category: 'chinta',
            description: 'Cloud Admin PIN Store',
            published_at: '2026-01-01T00:00:00Z',
            formatted_date: '১ জানুয়ারি, ২০২৬',
            tags: [],
            body: JSON.stringify({ pin: newPin, updatedAt: new Date().toISOString() }),
            word_count: 0,
            footnotes: [],
            updated_at: new Date().toISOString()
          },
          { onConflict: 'slug' }
        ),
        4000
      );
      if (error) {
        console.error('[DB] Error saving PIN to Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[DB] Supabase PIN save timeout/error:', err);
      return false;
    }
  }

  return true;
}

export async function verifyAdminPinAsync(rawEnteredPin: string): Promise<boolean> {
  const entered = normalizeDigits(rawEnteredPin);
  if (!entered) return false;
  const currentPin = await getAdminPinAsync();
  return entered === currentPin;
}

// ========================================================
// 📚 Universal Bookshelf Cloud Engine
// ========================================================
export const CLOUD_BOOKSHELF_SLUG = '__bookshelf_store__';

let inMemoryBookshelfCache: any = null;
let lastBookshelfCacheTime = 0;

export async function getBookshelfAsync(): Promise<any> {
  if (inMemoryBookshelfCache && Date.now() - lastBookshelfCacheTime < CACHE_TTL_MS) {
    return { ...inMemoryBookshelfCache };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('posts')
          .select('body')
          .eq('slug', CLOUD_BOOKSHELF_SLUG)
          .maybeSingle(),
        3500
      );
      if (!error && data && data.body) {
        const parsed = JSON.parse(data.body);
        if (parsed && (Array.isArray(parsed.readBooks) || Array.isArray(parsed.wishlistBooks))) {
          inMemoryBookshelfCache = parsed;
          lastBookshelfCacheTime = Date.now();
          return { ...parsed };
        }
      }
    } catch (e: any) {
      console.warn('[DB] Supabase bookshelf query failed:', e.message);
    }
  }

  if (inMemoryBookshelfCache) return { ...inMemoryBookshelfCache };
  return staticBookshelf;
}

export async function saveBookshelfAsync(data: any): Promise<boolean> {
  if (!data || typeof data !== 'object') return false;

  inMemoryBookshelfCache = data;
  lastBookshelfCacheTime = Date.now();

  try {
    const fs = getFs();
    const p = getLocalPath('src/data/bookshelf.json');
    if (fs && p) {
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {}

  if (isSupabaseConfigured && supabase) {
    try {
      await withTimeout(
        supabase.from('posts').upsert(
          {
            slug: CLOUD_BOOKSHELF_SLUG,
            title: 'System Cloud Bookshelf Store',
            category: 'chinta',
            description: 'Cloud Bookshelf Store',
            published_at: '2026-01-01T00:00:00Z',
            formatted_date: '১ জানুয়ারি, ২০২৬',
            tags: [],
            body: JSON.stringify(data),
            word_count: 0,
            footnotes: [],
            updated_at: new Date().toISOString()
          },
          { onConflict: 'slug' }
        ),
        4000
      );
      return true;
    } catch (err) {
      console.error('[DB] Supabase bookshelf save error:', err);
      return false;
    }
  }
  return true;
}
