import type { APIRoute } from 'astro';
import { updateAuthorAvatar, getAuthor } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  const author = getAuthor();
  return new Response(JSON.stringify({ success: true, avatar: author?.avatar || '/images/affan-labib.jpg' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { avatar } = await request.json();
    if (!avatar) {
      return new Response(JSON.stringify({ success: false, message: 'Avatar data required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = updateAuthorAvatar(avatar);
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
