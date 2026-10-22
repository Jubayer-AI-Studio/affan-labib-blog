// src/pages/sitemap.xml.ts
import type { APIRoute } from 'astro';
import { getAllPostsAsync, getCategoriesAsync } from '../lib/db';

export const prerender = false;

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const GET: APIRoute = async () => {
  const siteUrl = 'https://affan-labib-blog.vercel.app';
  const now = new Date().toISOString();

  let posts: any[] = [];
  let categories: any[] = [];

  try {
    const [p, c] = await Promise.all([
      getAllPostsAsync(),
      getCategoriesAsync()
    ]);
    posts = p || [];
    categories = c || [];
  } catch (err) {
    console.error('[Sitemap] Failed to load dynamic database data:', err);
  }

  // Core static pages with authority weight
  const staticPages = [
    { loc: `${siteUrl}/`, changefreq: 'daily', priority: '1.0', lastmod: now },
    { loc: `${siteUrl}/about`, changefreq: 'weekly', priority: '0.9', lastmod: now },
    { loc: `${siteUrl}/bookshelf`, changefreq: 'weekly', priority: '0.8', lastmod: now },
    { loc: `${siteUrl}/search`, changefreq: 'monthly', priority: '0.7', lastmod: now },
  ];

  // Category taxonomy pages
  const categoryPages = categories.map((cat) => ({
    loc: `${siteUrl}/category/${cat.id}`,
    changefreq: 'daily',
    priority: '0.8',
    lastmod: now
  }));

  // Article pages
  const postPages = posts.map((post) => {
    let postDate = now;
    if (post.publishedAt) {
      try {
        const d = new Date(post.publishedAt);
        if (!isNaN(d.getTime())) {
          postDate = d.toISOString();
        }
      } catch (_) {
        postDate = now;
      }
    }
    return {
      loc: `${siteUrl}/${post.slug}`,
      changefreq: 'weekly',
      priority: '0.85',
      lastmod: postDate
    };
  });

  const allUrls = [...staticPages, ...categoryPages, ...postPages];

  const xmlEntries = allUrls.map((item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${xmlEntries}
</urlset>`;

  return new Response(sitemapXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
