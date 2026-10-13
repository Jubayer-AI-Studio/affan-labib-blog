import posts from '../data/posts.json';

export async function GET(context) {
  const siteUrl = 'https://affan-labib-blog.vercel.app';

  const items = posts.map((post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/${post.slug}</link>
      <guid>${siteUrl}/${post.slug}</guid>
      <description><![CDATA[${post.description}]]></description>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <author>আফফান লাবীব</author>
      <category>${post.category}</category>
    </item>
  `).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>আফফান লাবীব | চিন্তা ও পাঠের নিভৃত আঙিনা</title>
    <link>${siteUrl}</link>
    <description>সরল চিন্তা, পাঠের আনন্দ, ইতিহাসচর্চা ও বই-আলোচনার ব্যক্তিগত ঘর।</description>
    <language>bn</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}
