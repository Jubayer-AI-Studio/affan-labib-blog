import type { APIRoute } from 'astro';
import { getAllPosts, deletePostBySlug, savePost } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  const posts = getAllPosts();
  return new Response(JSON.stringify({ success: true, posts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
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

    const success = deletePostBySlug(slug);
    if (success) {
      const remainingPosts = getAllPosts();
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

    const success = savePost(postData);
    return new Response(JSON.stringify({ success }), {
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
