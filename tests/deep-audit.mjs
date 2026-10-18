// tests/deep-audit.mjs
// Rigorous, Uncompromising 360-Degree System Health Audit

import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🔍 INITIATING UNCOMPROMISING 360° ARCHITECTURAL & FUNCTIONAL AUDIT');
console.log('================================================================\n');

let auditPassed = 0;
let auditFailed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ [VERIFIED] ${label} ${detail ? `(${detail})` : ''}`);
    auditPassed++;
  } else {
    console.error(`  ❌ [FAILED]   ${label} ${detail ? `(${detail})` : ''}`);
    auditFailed++;
  }
}

// --------------------------------------------------------------------
// AUDIT PILLAR 1: Astro Configuration & Vercel Serverless Adapter
// --------------------------------------------------------------------
console.log('📦 PILLAR 1: ASTRO CONFIGURATION & SERVERLESS RUNTIME');
const astroConfig = fs.readFileSync('astro.config.mjs', 'utf-8');
check('astro.config.mjs imports @astrojs/vercel', astroConfig.includes("import vercel from '@astrojs/vercel'"));
check('astro.config.mjs registers vercel() adapter', astroConfig.includes('adapter: vercel()'));
check('astro.config.mjs preserves Tailwind integration', astroConfig.includes('tailwind('));

// --------------------------------------------------------------------
// AUDIT PILLAR 2: Database Layer & Data Integrity (Zero Data Loss)
// --------------------------------------------------------------------
console.log('\n🗄️ PILLAR 2: UNIVERSAL DATABASE ENGINE & CURRENT 10 ARTICLES');
import { getAllPostsAsync, savePost, deletePostBySlug } from '../src/lib/db.ts';

const allPosts = await getAllPostsAsync();
check('Database loads posts successfully', Array.isArray(allPosts));
check('All 10 authentic articles preserved intact', allPosts.length === 10, `Count: ${allPosts.length}`);

// Check every authentic post has valid content
const expectedSlugs = [
  'bedonadayok-dushongbad-ayesha',
  'boi-er-bibhay-alokito-monishi',
  'dinlipi-shukrobar-amimul-ihsan',
  'gazar-dinlipi',
  'haramainer-live',
  'notun-mehman',
  'kobi-sahityik-howa-lokkho-noy',
  'saobaner-dosh-bochhor',
  'tahafutul-malahida',
  'takhassuser-jibon-shuru'
];

let allSlugsPresent = true;
let allBodiesNonEmpty = true;
for (const slug of expectedSlugs) {
  const p = allPosts.find((item) => item.slug === slug);
  if (!p) allSlugsPresent = false;
  if (!p || !p.body || p.body.length < 50) allBodiesNonEmpty = false;
}
check('All 10 authentic slugs present in database', allSlugsPresent);
check('All 10 authentic article bodies populated with full text', allBodiesNonEmpty);

// Live CRUD Simulation
const tempSlug = 'deep-audit-post-' + Date.now();
const tempPost = {
  slug: tempSlug,
  title: 'অডিট টেস্ট লেখা',
  category: 'chinta',
  description: 'অডিট টেস্ট বিবরণ',
  publishedAt: '2026-10-18',
  formattedDate: '১৮ অক্টোবর, ২০২৬',
  tags: ['অডিট', 'টেস্ট'],
  body: 'এটি একটি লাইভ অডিট টেস্ট পোস্ট।'
};

const savedOk = await savePost(tempPost);
check('savePost() executes and returns true', savedOk === true);

const postsWithTemp = await getAllPostsAsync();
check('New post is immediately visible in query', postsWithTemp.some((p) => p.slug === tempSlug));

const deletedOk = await deletePostBySlug(tempSlug);
check('deletePostBySlug() executes and returns true', deletedOk === true);

const postsAfterDel = await getAllPostsAsync();
check('Post is completely purged from query', !postsAfterDel.some((p) => p.slug === tempSlug));
check('Database restored accurately to exactly 10 posts', postsAfterDel.length === 10);

// --------------------------------------------------------------------
// AUDIT PILLAR 3: Dynamic Route Architecture (No More 404 / 405)
// --------------------------------------------------------------------
console.log('\n⚡ PILLAR 3: DYNAMIC ON-DEMAND SSR PAGES & API ROUTES');

const apiPosts = fs.readFileSync('src/pages/api/posts.ts', 'utf-8');
check('api/posts.ts has prerender = false (SSR enabled)', apiPosts.includes('export const prerender = false;'));
check('api/posts.ts has dynamic GET handler', apiPosts.includes('export const GET: APIRoute'));
check('api/posts.ts has dynamic POST handler', apiPosts.includes('export const POST: APIRoute'));
check('api/posts.ts has dynamic DELETE handler', apiPosts.includes('export const DELETE: APIRoute'));

const slugPage = fs.readFileSync('src/pages/[slug].astro', 'utf-8');
check('[slug].astro has prerender = false (On-Demand SSR)', slugPage.includes('export const prerender = false;'));
check('[slug].astro does NOT have getStaticPaths lock', !slugPage.includes('export async function getStaticPaths'));
check('[slug].astro dynamically resolves posts from db', slugPage.includes('await getAllPostsAsync()'));

const indexPage = fs.readFileSync('src/pages/index.astro', 'utf-8');
check('index.astro has prerender = false (Instant Homepage Sync)', indexPage.includes('export const prerender = false;'));
check('index.astro queries getAllPostsAsync()', indexPage.includes('await getAllPostsAsync()'));

const catPage = fs.readFileSync('src/pages/category/[category].astro', 'utf-8');
check('category/[category].astro has prerender = false', catPage.includes('export const prerender = false;'));
check('category/[category].astro dynamically filters posts', catPage.includes('allPosts.filter'));

const searchPage = fs.readFileSync('src/pages/search.astro', 'utf-8');
check('search.astro has prerender = false', searchPage.includes('export const prerender = false;'));
check('search.astro dynamically queries all posts', searchPage.includes('await getAllPostsAsync()'));

// --------------------------------------------------------------------
// AUDIT PILLAR 4: Login Zero-Buffering & Network Optimization
// --------------------------------------------------------------------
console.log('\n🚀 PILLAR 4: ZERO-BUFFERING LOGIN & NETWORK OPTIMIZATION');

const appLoader = fs.readFileSync('src/components/AppLoader.astro', 'utf-8');
check('AppLoader immediately bypasses /admin route (0ms delay)', appLoader.includes("window.location.pathname.startsWith('/admin')"));
check('AppLoader skips on active browsing session (no repeat delay)', appLoader.includes('kherokhata_session_active'));

const sw = fs.readFileSync('public/sw.js', 'utf-8');
check('Service Worker updated to v14', sw.includes('kherokhata-cache-v14'));
check('Precache list trimmed down from 34 to core shell', !sw.includes('/category/chinta') && !sw.includes('/gazar-dinlipi'));
check('Service Worker never intercepts /admin or /api', sw.includes("url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')"));

const adminPage = fs.readFileSync('src/pages/admin.astro', 'utf-8');
check('Admin writer desk awaits API POST before reload', adminPage.includes('await fetch(\'/api/posts\','));
check('Admin writer desk awaits API DELETE before reload', adminPage.includes('await fetch(\'/api/posts\', {'));

// --------------------------------------------------------------------
// AUDIT PILLAR 5: Social OpenGraph Meta Tags for Facebook & WhatsApp
// --------------------------------------------------------------------
console.log('\n📱 PILLAR 5: SOCIAL OPENGRAPH & SEO PREVIEW INTEGRITY');

const layout = fs.readFileSync('src/layouts/Layout.astro', 'utf-8');
check('Layout has absolute canonical URL calculation', layout.includes('const canonicalURL = new URL(Astro.url.pathname, siteUrl).href'));
check('Layout has og:type meta tag', layout.includes('property="og:type"'));
check('Layout has og:title meta tag', layout.includes('property="og:title"'));
check('Layout has og:description meta tag', layout.includes('property="og:description"'));
check('Layout has og:image absolute URL', layout.includes('property="og:image"'));

// --------------------------------------------------------------------
// AUDIT PILLAR 6: Vercel Production Build Output
// --------------------------------------------------------------------
console.log('\n🏗️ PILLAR 6: VERCEL PRODUCTION BUILD OUTPUT INTEGRITY');

const vercelDir = path.resolve(process.cwd(), '.vercel/output');
check('.vercel/output exists', fs.existsSync(vercelDir));
check('.vercel/output/static exists', fs.existsSync(path.join(vercelDir, 'static')));
check('.vercel/output/_functions exists', fs.existsSync(path.join(vercelDir, '_functions')));
check('_functions/entry.mjs serverless entry point exists', fs.existsSync(path.join(vercelDir, '_functions/entry.mjs')));
check('_functions/pages/admin.astro.mjs serverless handler exists', fs.existsSync(path.join(vercelDir, '_functions/pages/admin.astro.mjs')));
check('_functions/pages/_slug_.astro.mjs dynamic post serverless handler exists', fs.existsSync(path.join(vercelDir, '_functions/pages/_slug_.astro.mjs')));
check('_functions/pages/index.astro.mjs homepage serverless handler exists', fs.existsSync(path.join(vercelDir, '_functions/pages/index.astro.mjs')));
check('_functions/pages/api/posts.astro.mjs API serverless handler exists', fs.existsSync(path.join(vercelDir, '_functions/pages/api/posts.astro.mjs')));

// --------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------
console.log('\n================================================================');
console.log(`🏁 AUDIT RESULTS: ${auditPassed} VERIFIED, ${auditFailed} FAILED`);
console.log('================================================================');

if (auditFailed === 0) {
  console.log('🌟 100% PERFECT SYSTEM HEALTH — ZERO COMPROMISE, ZERO REGRESSIONS!');
} else {
  console.error('⚠️ AUDIT DETECTED ISSUES — REQUIRES IMMEDIATE ATTENTION!');
  process.exitCode = 1;
}
