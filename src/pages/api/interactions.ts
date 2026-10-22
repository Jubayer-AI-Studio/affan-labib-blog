// src/pages/api/interactions.ts
import type { APIRoute } from 'astro';
import {
  getArticleInteractions,
  incrementView,
  toggleLike,
  addComment,
  deleteComment,
  getAllInteractionsForAdmin,
  formatBengaliRelativeTime,
  toBnDigits
} from '../../lib/interactions';

export const prerender = false;

function sanitize(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get('slug');
    const isAdmin = url.searchParams.get('admin') === 'true';

    if (isAdmin) {
      const data = await getAllInteractionsForAdmin();
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Slug parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { views, likes, comments } = await getArticleInteractions(slug);

    // Format relative time for each comment
    const formattedComments = comments.map((c) => ({
      ...c,
      formattedTime: formatBengaliRelativeTime(c.createdAt),
      replies: (c.replies || []).map((r) => ({
        ...r,
        formattedTime: formatBengaliRelativeTime(r.createdAt)
      }))
    }));

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          views,
          likes,
          viewsBn: toBnDigits(views),
          likesBn: toBnDigits(likes)
        },
        comments: formattedComments
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (err: any) {
    console.error('[API Interactions GET Error]:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, slug } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. View Action
    if (action === 'view') {
      if (!slug) return new Response(JSON.stringify({ error: 'Slug required' }), { status: 400 });
      const views = await incrementView(slug);
      return new Response(
        JSON.stringify({ success: true, views, viewsBn: toBnDigits(views) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Like Action (toggle: isLike boolean)
    if (action === 'like') {
      if (!slug) return new Response(JSON.stringify({ error: 'Slug required' }), { status: 400 });
      const isLike = body.isLike !== false; // defaults to true
      const likes = await toggleLike(slug, isLike);
      return new Response(
        JSON.stringify({ success: true, likes, likesBn: toBnDigits(likes) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Comment Action
    if (action === 'comment') {
      if (!slug) return new Response(JSON.stringify({ error: 'Slug required' }), { status: 400 });
      const rawContent = (body.content || '').trim();
      if (!rawContent) {
        return new Response(
          JSON.stringify({ success: false, error: 'মন্তব্য খালি রাখা যাবে না।' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (rawContent.length > 800) {
        return new Response(
          JSON.stringify({ success: false, error: 'মন্তব্য ৮০০ অক্ষরের মধ্যে হতে হবে।' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const rawAuthor = (body.authorName || '').trim().substring(0, 50);
      const cleanContent = sanitize(rawContent);
      const cleanAuthor = sanitize(rawAuthor) || 'মুগ্ধ পাঠক';

      const comment = await addComment(slug, cleanContent, cleanAuthor, false);
      return new Response(
        JSON.stringify({
          success: true,
          comment: {
            ...comment,
            formattedTime: 'এইমাত্র'
          }
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Author Reply Action
    if (action === 'reply') {
      if (!slug || !body.parentId) {
        return new Response(JSON.stringify({ error: 'Slug and parentId required' }), { status: 400 });
      }
      const rawContent = (body.content || '').trim();
      if (!rawContent) {
        return new Response(JSON.stringify({ error: 'উত্তরের বিষয় খালি রাখা যাবে না।' }), { status: 400 });
      }

      const cleanContent = sanitize(rawContent);
      const authorName = (body.authorName || '').trim() || 'আফফান লাবীব (লেখক)';

      const reply = await addComment(slug, cleanContent, authorName, true, body.parentId);
      return new Response(
        JSON.stringify({
          success: true,
          reply: {
            ...reply,
            formattedTime: 'এইমাত্র'
          }
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Delete Comment Action (Admin)
    if (action === 'delete_comment') {
      const commentId = body.commentId;
      if (!commentId) {
        return new Response(JSON.stringify({ error: 'commentId required' }), { status: 400 });
      }
      const success = await deleteComment(commentId);
      return new Response(
        JSON.stringify({ success }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Interactions POST Error]:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
