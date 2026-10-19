// src/lib/db.ts
// Universal Cloud Database Engine with Supabase & GitHub Sync

import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from './supabase.ts';
import { syncPostsToGitHub } from './githubSync.ts';

const POSTS_PATH = path.resolve(process.cwd(), 'src/data/posts.json');
const AUTHOR_PATH = path.resolve(process.cwd(), 'src/data/author.json');
const BOOKSHELF_PATH = path.resolve(process.cwd(), 'src/data/bookshelf.json');
const CATEGORIES_PATH = path.resolve(process.cwd(), 'src/data/categories.json');

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
}

// In-memory runtime cache for serverless instances
let inMemoryPostsCache: Post[] | null = null;
let lastPostsCacheTime = 0;
let inMemoryCategoriesCache: Category[] | null = null;
let lastCategoriesCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

export function getLocalPosts(): Post[] {
  try {
    if (fs.existsSync(POSTS_PATH)) {
      const data = fs.readFileSync(POSTS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error reading local posts:', err);
  }
  return [];
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
        const mapped = data.map((row: any) => ({
          slug: row.slug,
          title: row.title,
          category: row.category,
          description: row.description || '',
          publishedAt: row.published_at,
          formattedDate: row.formatted_date || row.published_at,
          tags: Array.isArray(row.tags) ? row.tags : [],
          body: row.body || '',
          wordCount: row.word_count || 0,
          footnotes: Array.isArray(row.footnotes) ? row.footnotes : []
        }));
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
            tags: newPost.tags,
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
    try {
      fs.writeFileSync(POSTS_PATH, JSON.stringify(current, null, 2), 'utf-8');
    } catch (e) {
      // In serverless, filesystem is read-only, which is expected
    }

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
    try {
      fs.writeFileSync(POSTS_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    } catch (e) {}

    // 3. Trigger GitHub background sync
    syncPostsToGitHub(filtered).catch(() => {});

    return true;
  } catch (err) {
    console.error('[DB] Error deleting post:', err);
    return false;
  }
}

export function getAuthor(): any {
  try {
    if (fs.existsSync(AUTHOR_PATH)) {
      return JSON.parse(fs.readFileSync(AUTHOR_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('[DB] Error reading author:', err);
  }
  return null;
}

export function updateAuthorAvatar(avatarDataUrl: string): boolean {
  try {
    if (fs.existsSync(AUTHOR_PATH)) {
      const data = JSON.parse(fs.readFileSync(AUTHOR_PATH, 'utf-8'));
      data.avatar = avatarDataUrl;
      fs.writeFileSync(AUTHOR_PATH, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    }
  } catch (err) {
    console.error('[DB] Error updating author avatar:', err);
  }
  return false;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'chinta', title: 'চিন্তা', desc: 'সরল মনন, জীবন ও দৈনন্দিন ভাবনার নানা প্রসঙ্গ', icon: '💭' },
  { id: 'pathalap', title: 'পাঠালাপ', desc: 'বই পড়তে পড়তে জেগে ওঠা চিন্তা ও আলাপচারিতা', icon: '📖' },
  { id: 'itihas', title: 'ইতিহাস', desc: 'অতীত ঐতিহ্য, মনীষী জীবন ও ইতিহাসের গভীর অনুসন্ধান', icon: '🏛️' },
  { id: 'boi-alochona', title: 'বই-আলোচনা', desc: 'পঠিত প্রিয় বইগুলোর ব্যক্তিগত পর্যালোচনা ও পাঠপ্রতিক্রিয়া', icon: '📚' },
  { id: 'onubad', title: 'অনুবাদ', desc: 'আরবি ও অন্যান্য ভাষার ধ্রুপদী ও সমকালীন সাহিত্যের অনুবাদ', icon: '🌐' }
];

export function getLocalCategories(): Category[] {
  try {
    if (fs.existsSync(CATEGORIES_PATH)) {
      const data = fs.readFileSync(CATEGORIES_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('[DB] Error reading local categories:', err);
  }
  return DEFAULT_CATEGORIES;
}

export async function getCategoriesAsync(): Promise<Category[]> {
  // 1. High-speed in-memory cache check (0.1ms instant resolution)
  if (inMemoryCategoriesCache && inMemoryCategoriesCache.length > 0 && Date.now() - lastCategoriesCacheTime < CACHE_TTL_MS) {
    return [...inMemoryCategoriesCache];
  }

  // 2. Try Supabase if configured (guarded by 4s timeout)
  if (isSupabaseConfigured && supabase) {
    try {
      const query = supabase
        .from('categories')
        .select('*');
      const { data, error } = await withTimeout(query, 4000);

      if (!error && data && data.length > 0) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          desc: row.desc || '',
          icon: row.icon || '📁'
        }));
        inMemoryCategoriesCache = mapped;
        lastCategoriesCacheTime = Date.now();
        return [...mapped];
      }
    } catch (e: any) {
      // Table may not exist yet, fallback smoothly
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
    if (!newCat.id || !newCat.title) return false;
    const cleanId = newCat.id.toLowerCase().trim().replace(/[^\w-]+/g, '-');
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

    // Supabase upsert (silent if table doesn't exist)
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('categories').upsert(
          {
            id: categoryToSave.id,
            title: categoryToSave.title,
            desc: categoryToSave.desc,
            icon: categoryToSave.icon
          },
          { onConflict: 'id' }
        );
      } catch (err) {}
    }

    // Write to local file
    try {
      fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(current, null, 2), 'utf-8');
    } catch (e) {}

    return true;
  } catch (err) {
    console.error('[DB] Error saving category:', err);
    return false;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const coreIds = ['chinta', 'pathalap', 'itihas', 'boi-alochona', 'onubad'];
    if (coreIds.includes(id)) {
      return false; // protect core baseline categories
    }

    const current = await getCategoriesAsync();
    const filtered = current.filter((c) => c.id !== id);
    if (filtered.length === current.length) return false;

    inMemoryCategoriesCache = filtered;
    lastCategoriesCacheTime = Date.now();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('categories').delete().eq('id', id);
      } catch (e) {}
    }

    try {
      fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    } catch (e) {}

    return true;
  } catch (err) {
    console.error('[DB] Error deleting category:', err);
    return false;
  }
}
