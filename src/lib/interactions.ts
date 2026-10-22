// src/lib/interactions.ts
// Universal Interactions Engine (Views, Likes, Comments, Author Replies)
// Equipped with Supabase Cloud Sync and In-Memory/Local Fallback

import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from './supabase.ts';

const INTERACTIONS_PATH = path.resolve(process.cwd(), 'src/data/interactions.json');

export interface CommentItem {
  id: string;
  slug: string;
  parentId?: string | null;
  authorName: string;
  isAuthor: boolean;
  content: string;
  createdAt: string;
  replies?: CommentItem[];
}

export interface ArticleStat {
  views: number;
  likes: number;
}

interface LocalStore {
  stats: Record<string, ArticleStat>;
  comments: CommentItem[];
}

// In-memory runtime cache for serverless execution
let inMemoryStore: LocalStore | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15 * 1000; // 15 seconds

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBnDigits(n: number | string): string {
  return (n ?? 0).toString().replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function formatBengaliRelativeTime(isoDate: string): string {
  try {
    const then = new Date(isoDate).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return 'এইমাত্র';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${toBnDigits(diffMin)} মিনিট আগে`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${toBnDigits(diffHours)} ঘণ্টা আগে`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'গতকাল';
    if (diffDays < 30) return `${toBnDigits(diffDays)} দিন আগে`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${toBnDigits(diffMonths)} মাস আগে`;
    return `${toBnDigits(Math.floor(diffMonths / 12))} বছর আগে`;
  } catch {
    return 'কিছুক্ষণ আগে';
  }
}

function loadLocalStore(): LocalStore {
  try {
    if (fs.existsSync(INTERACTIONS_PATH)) {
      const data = fs.readFileSync(INTERACTIONS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Interactions] Error reading local interactions:', err);
  }
  return { stats: {}, comments: [] };
}

function saveLocalStore(store: LocalStore): void {
  try {
    fs.writeFileSync(INTERACTIONS_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // In read-only serverless, file write may fail, which is safely expected
  }
}

function getStore(): LocalStore {
  if (inMemoryStore && Date.now() - lastCacheTime < CACHE_TTL_MS) {
    return inMemoryStore;
  }
  const loaded = loadLocalStore();
  inMemoryStore = loaded;
  lastCacheTime = Date.now();
  return loaded;
}

export async function getArticleInteractions(slug: string): Promise<{
  views: number;
  likes: number;
  comments: CommentItem[];
}> {
  const store = getStore();

  // 1. Try fetching from Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const [statsRes, commentsRes] = await Promise.all([
        supabase.from('article_stats').select('views_count, likes_count').eq('slug', slug).single(),
        supabase.from('comments').select('*').eq('slug', slug).order('created_at', { ascending: true })
      ]);

      let views = store.stats[slug]?.views || 0;
      let likes = store.stats[slug]?.likes || 0;

      if (!statsRes.error && statsRes.data) {
        views = statsRes.data.views_count || 0;
        likes = statsRes.data.likes_count || 0;
        // update local cache
        store.stats[slug] = { views, likes };
      }

      if (!commentsRes.error && commentsRes.data) {
        const rawComments: CommentItem[] = commentsRes.data.map((c: any) => ({
          id: c.id,
          slug: c.slug,
          parentId: c.parent_id,
          authorName: c.author_name || 'মুগ্ধ পাঠক',
          isAuthor: Boolean(c.is_author),
          content: c.content,
          createdAt: c.created_at
        }));

        // Build threaded hierarchy
        const rootComments: CommentItem[] = [];
        const replyMap = new Map<string, CommentItem[]>();

        for (const item of rawComments) {
          if (item.parentId) {
            const arr = replyMap.get(item.parentId) || [];
            arr.push(item);
            replyMap.set(item.parentId, arr);
          } else {
            rootComments.push(item);
          }
        }

        for (const root of rootComments) {
          root.replies = replyMap.get(root.id) || [];
        }

        return { views, likes, comments: rootComments };
      }
    } catch (e: any) {
      console.warn('[Interactions] Supabase fetch fallback to local:', e.message);
    }
  }

  // Fallback to local store
  const stat = store.stats[slug] || { views: 0, likes: 0 };
  const allSlugComments = store.comments.filter((c) => c.slug === slug);

  const rootComments: CommentItem[] = [];
  const replyMap = new Map<string, CommentItem[]>();

  for (const item of allSlugComments) {
    if (item.parentId) {
      const arr = replyMap.get(item.parentId) || [];
      arr.push(item);
      replyMap.set(item.parentId, arr);
    } else {
      rootComments.push(item);
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

export async function incrementView(slug: string): Promise<number> {
  const store = getStore();
  if (!store.stats[slug]) {
    store.stats[slug] = { views: 0, likes: 0 };
  }
  store.stats[slug].views += 1;
  const newViews = store.stats[slug].views;
  saveLocalStore(store);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('article_stats').upsert(
        {
          slug,
          views_count: newViews,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'slug' }
      );
    } catch (err) {
      console.warn('[Interactions] Supabase incrementView error:', err);
    }
  }

  return newViews;
}

export async function toggleLike(slug: string, isLike: boolean): Promise<number> {
  const store = getStore();
  if (!store.stats[slug]) {
    store.stats[slug] = { views: 0, likes: 0 };
  }
  if (isLike) {
    store.stats[slug].likes += 1;
  } else {
    store.stats[slug].likes = Math.max(0, store.stats[slug].likes - 1);
  }
  const newLikes = store.stats[slug].likes;
  saveLocalStore(store);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('article_stats').upsert(
        {
          slug,
          likes_count: newLikes,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'slug' }
      );
    } catch (err) {
      console.warn('[Interactions] Supabase toggleLike error:', err);
    }
  }

  return newLikes;
}

export async function addComment(
  slug: string,
  content: string,
  authorName?: string,
  isAuthor?: boolean,
  parentId?: string | null
): Promise<CommentItem> {
  const store = getStore();
  const id = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = (authorName || '').trim() || (isAuthor ? 'আফফান লাবীব (লেখক)' : 'মুগ্ধ পাঠক');
  const now = new Date().toISOString();

  const newComment: CommentItem = {
    id,
    slug,
    parentId: parentId || null,
    authorName: cleanName,
    isAuthor: Boolean(isAuthor),
    content: content.trim(),
    createdAt: now,
    replies: []
  };

  store.comments.push(newComment);
  saveLocalStore(store);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('comments').insert({
        id,
        slug,
        parent_id: parentId || null,
        author_name: cleanName,
        is_author: Boolean(isAuthor),
        content: content.trim(),
        created_at: now
      }).select().single();

      if (!error && data) {
        return {
          id: data.id,
          slug: data.slug,
          parentId: data.parent_id,
          authorName: data.author_name,
          isAuthor: data.is_author,
          content: data.content,
          createdAt: data.created_at,
          replies: []
        };
      }
    } catch (err) {
      console.warn('[Interactions] Supabase insert comment error:', err);
    }
  }

  return newComment;
}

export async function deleteComment(id: string): Promise<boolean> {
  const store = getStore();
  // Remove comment and its replies
  const initialLen = store.comments.length;
  store.comments = store.comments.filter((c) => c.id !== id && c.parentId !== id);
  const removed = store.comments.length < initialLen;
  saveLocalStore(store);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('comments').delete().eq('id', id);
    } catch (err) {
      console.warn('[Interactions] Supabase delete comment error:', err);
    }
  }

  return removed;
}

export async function getAllInteractionsForAdmin(): Promise<{
  stats: Record<string, ArticleStat>;
  comments: CommentItem[];
}> {
  const store = getStore();

  if (isSupabaseConfigured && supabase) {
    try {
      const [statsRes, commentsRes] = await Promise.all([
        supabase.from('article_stats').select('*'),
        supabase.from('comments').select('*').order('created_at', { ascending: false })
      ]);

      if (!statsRes.error && statsRes.data) {
        for (const row of statsRes.data) {
          store.stats[row.slug] = {
            views: row.views_count || 0,
            likes: row.likes_count || 0
          };
        }
      }

      if (!commentsRes.error && commentsRes.data) {
        store.comments = commentsRes.data.map((c: any) => ({
          id: c.id,
          slug: c.slug,
          parentId: c.parent_id,
          authorName: c.author_name || 'মুগ্ধ পাঠক',
          isAuthor: Boolean(c.is_author),
          content: c.content,
          createdAt: c.created_at
        }));
      }
    } catch (e: any) {
      console.warn('[Interactions] Supabase admin fetch fallback:', e.message);
    }
  }

  return {
    stats: store.stats,
    comments: [...store.comments]
  };
}
