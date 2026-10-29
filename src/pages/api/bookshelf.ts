import type { APIRoute } from 'astro';
import { getBookshelfAsync, saveBookshelfAsync } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const bookshelf = await getBookshelfAsync();
    return new Response(JSON.stringify({ success: true, bookshelf }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ success: false, message: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const saved = await saveBookshelfAsync(body);
    if (!saved) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to save bookshelf' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, bookshelf: body }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
