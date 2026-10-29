// src/pages/api/interactions.ts
import type { APIRoute } from 'astro';
import {
  getArticleStatsAndComments,
  incrementView,
  toggleLike,
  addComment,
  deleteComment,
  getAllInteractionsForAdmin,
  toBnDigits
} from '../../lib/interactions';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get('slug');
    const isAdmin = url.searchParams.get('admin') === 'true';

    if (isAdmin) {
      const data = await getAllInteractionsForAdmin();
      return new Response(
        JSON.stringify({
          success: true,
          data,
          stats: data.stats,
          comments: data.comments
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Slug parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const res = await getArticleStatsAndComments(slug);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          views: res.views,
          likes: res.likes,
          viewsBn: toBnDigits(res.views),
          likesBn: toBnDigits(res.likes)
        },
        comments: res.comments
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
    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. View Action
    if (action === 'view') {
      const slug = body.slug;
      if (!slug) return new Response(JSON.stringify({ success: false, error: 'Slug required' }), { status: 400 });
      const views = await incrementView(slug);
      return new Response(
        JSON.stringify({ success: true, views, viewsBn: toBnDigits(views) }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // 2. Like Action (toggle: isLike boolean)
    if (action === 'like') {
      const slug = body.slug;
      if (!slug) return new Response(JSON.stringify({ success: false, error: 'Slug required' }), { status: 400 });
      const isLike = body.isLike !== false;
      const likes = await toggleLike(slug, isLike);
      return new Response(
        JSON.stringify({ success: true, likes, likesBn: toBnDigits(likes) }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // 3. Comment Action
    if (action === 'comment') {
      const { slug, content, authorName } = body;
      if (!slug || !content || !content.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Slug and comment content are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const comment = await addComment(slug, content, authorName, false, null);
      return new Response(
        JSON.stringify({ success: true, comment }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // 4. Author Reply Action
    if (action === 'reply') {
      const { slug, parentId, content, authorName } = body;
      if (!slug || !parentId || !content || !content.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Slug, parentId and content required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const reply = await addComment(slug, content, authorName || 'আফফান লাবীব (লেখক)', true, parentId);
      return new Response(
        JSON.stringify({ success: true, comment: reply }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // 5. Delete Comment Action (Admin Moderation)
    if (action === 'delete_comment') {
      const { commentId, content } = body;
      const target = String(commentId || content || '').trim();
      if (!target) {
        return new Response(
          JSON.stringify({ success: false, error: 'commentId or content is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const deleted = await deleteComment(target);
      return new Response(
        JSON.stringify({ success: deleted }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
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
