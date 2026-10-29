// src/pages/api/interactions.ts
import type { APIRoute } from 'astro';
import {
  getArticleStats,
  incrementView,
  toggleLike,
  getAllStatsForAdmin,
  toBnDigits
} from '../../lib/interactions';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get('slug');
    const isAdmin = url.searchParams.get('admin') === 'true';

    if (isAdmin) {
      const stats = await getAllStatsForAdmin();
      return new Response(JSON.stringify({ success: true, data: { stats, comments: [] }, stats }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Slug parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stat = await getArticleStats(slug);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          views: stat.views,
          likes: stat.likes,
          viewsBn: toBnDigits(stat.views),
          likesBn: toBnDigits(stat.likes)
        }
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

    if (!action || !slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action and slug are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. View Action
    if (action === 'view') {
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
