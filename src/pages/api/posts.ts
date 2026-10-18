import type { APIRoute } from 'astro';
import { getAllPostsAsync, deletePostBySlug, savePost } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  const posts = await getAllPostsAsync();
  return new Response(JSON.stringify({ success: true, posts }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0'
    }
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return new Response(JSON.stringify({ success: false, message: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await deletePostBySlug(slug);
    if (success) {
      const remainingPosts = await getAllPostsAsync();
      return new Response(JSON.stringify({ success: true, remainingCount: remainingPosts.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ success: false, message: 'Post not found or could not be deleted' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const postData = await request.json();
    if (!postData.title || !postData.body) {
      return new Response(JSON.stringify({ success: false, message: 'Title and body required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await savePost(postData);
    return new Response(JSON.stringify({ success, post: postData }), {
      status: success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
