import { getAllPostsAsync } from '../lib/db';

export const prerender = false;

function escapeCdata(str) {
  return (str || '').replace(/\]\]>/g, ']]]]><![CDATA[>');
}

export async function GET(context) {
  const siteUrl = 'https://affan-labib-blog.vercel.app';
  let posts = [];
  try {
    posts = await getAllPostsAsync();
  } catch (err) {
    console.error('[RSS] Error fetching posts:', err);
  }

  const items = posts.map((post) => {
    let pubDateStr = new Date().toUTCString();
    if (post.publishedAt) {
      try {
        const d = new Date(post.publishedAt);
        if (!isNaN(d.getTime())) {
          pubDateStr = d.toUTCString();
        }
      } catch (_) {}
    }

    return `    <item>
      <title><![CDATA[${escapeCdata(post.title)}]]></title>
      <link>${siteUrl}/${post.slug}</link>
      <guid isPermaLink="true">${siteUrl}/${post.slug}</guid>
      <description><![CDATA[${escapeCdata(post.description)}]]></description>
      <pubDate>${pubDateStr}</pubDate>
      <author>contact@affanlabib.me (আফফান লাবীব - Affan Labib)</author>
      <category><![CDATA[${escapeCdata(post.category)}]]></category>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>লাবীবের খেরোখাতা | আফফান লাবীব (Affan Labib)</title>
    <link>${siteUrl}</link>
    <description>Affan Labib (আফফান লাবীব)-এর অফিসিয়াল সাহিত্য সাময়িকী ও খেরোখাতা। চিন্তা, পাঠের আনন্দ, ইতিহাসচর্চা ও বই-আলোচনার ব্যক্তিগত ঘর।</description>
    <language>bn</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    }
  });
}
