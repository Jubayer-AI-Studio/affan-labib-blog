import fs from 'fs';
import path from 'path';

const POSTS_PATH = path.resolve(process.cwd(), 'src/data/posts.json');
const AUTHOR_PATH = path.resolve(process.cwd(), 'src/data/author.json');

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

export function getAllPosts(): Post[] {
  try {
    if (fs.existsSync(POSTS_PATH)) {
      const data = fs.readFileSync(POSTS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading posts:', err);
  }
  return [];
}

export function deletePostBySlug(slug: string): boolean {
  try {
    const posts = getAllPosts();
    const filtered = posts.filter((p) => p.slug !== slug);
    if (filtered.length !== posts.length) {
      fs.writeFileSync(POSTS_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  } catch (err) {
    console.error('Error deleting post:', err);
  }
  return false;
}

export function savePost(newPost: Post): boolean {
  try {
    const posts = getAllPosts();
    const existingIndex = posts.findIndex((p) => p.slug === newPost.slug);
    if (existingIndex >= 0) {
      posts[existingIndex] = newPost;
    } else {
      posts.unshift(newPost);
    }
    fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving post:', err);
  }
  return false;
}

export function getAuthor(): any {
  try {
    if (fs.existsSync(AUTHOR_PATH)) {
      return JSON.parse(fs.readFileSync(AUTHOR_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading author:', err);
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
    console.error('Error updating author avatar:', err);
  }
  return false;
}

