// src/lib/db.ts
// Universal Cloud Database Engine with Supabase & GitHub Sync

import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from './supabase.ts';
import { syncPostsToGitHub } from './githubSync.ts';

const POSTS_PATH = path.resolve(process.cwd(), 'src/data/posts.json');
const AUTHOR_PATH = path.resolve(process.cwd(), 'src/data/author.json');
const BOOKSHELF_PATH = path.resolve(process.cwd(), 'src/data/bookshelf.json');

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

export async function getAllPostsAsync(): Promise<Post[]> {
  // 1. Try Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('published_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
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
      }
    } catch (e: any) {
      console.warn('[DB] Supabase query failed, falling back:', e.message);
    }
  }

  // 2. Return in-memory cache if updated
  if (inMemoryPostsCache && inMemoryPostsCache.length > 0) {
    return [...inMemoryPostsCache];
  }

  // 3. Fallback to local posts.json
  const local = getLocalPosts();
  inMemoryPostsCache = local;
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
