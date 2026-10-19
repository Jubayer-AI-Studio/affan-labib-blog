import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🚀 RUNNING COMPREHENSIVE E2E VERIFICATION TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 1. Database & CRUD Logic Tests
console.log('📂 1. DATABASE & CRUD PERSISTENCE LAYER TESTS:');
import { getAllPosts, savePost, deletePostBySlug, getAuthor, updateAuthorAvatar } from '../src/lib/db.ts';

const initialPosts = [...getAllPosts()];
assert(Array.isArray(initialPosts) && initialPosts.length > 0, `Database has ${initialPosts.length} posts loaded`);

const testSlug = 'unit-test-verification-post-' + Date.now();
const testPost = {
  slug: testSlug,
  title: 'টেস্ট রচনা শিরোনাম',
  category: 'chinta',
  description: 'টেস্ট রচনার সারমর্ম',
  publishedAt: '2026-10-13',
  formattedDate: '১৩ অক্টোবর, ২০২৬',
  tags: ['টেস্ট'],
  body: 'এটি একটি স্বয়ংক্রিয় টেস্ট পোস্ট।'
};

// Test Save
const saveResult = await savePost(testPost);
assert(saveResult === true, 'savePost() successfully creates new post in posts.json');
const afterSavePosts = getAllPosts();
assert(afterSavePosts.some((p) => p.slug === testSlug), 'Newly created post is queryable from posts.json');

// Test Delete
const deleteResult = await deletePostBySlug(testSlug);
assert(deleteResult === true, 'deletePostBySlug() successfully removes post from posts.json');
const afterDeletePosts = getAllPosts();
assert(!afterDeletePosts.some((p) => p.slug === testSlug), 'Deleted post is permanently gone from posts.json');
assert(afterDeletePosts.length === initialPosts.length, 'Database post count accurately restored to initial state');

// Test Author DB
const author = getAuthor();
assert(author && author.name === 'আফফান লাবীব', 'Author details queryable from author.json');

// 2. Vercel Serverless Hybrid Build Artifacts & Route Tests
console.log('\n📄 2. VERCEL SERVERLESS HYBRID ARTIFACTS & INTEGRITY TESTS:');
const vercelOutput = path.resolve(process.cwd(), '.vercel/output');
assert(fs.existsSync(vercelOutput), '.vercel/output directory exists');

const requiredStatic = [
  'sw.js',
  'manifest.webmanifest',
  'favicon.svg',
  'images/affan-labib.jpg',
  'about/index.html',
  'bookshelf/index.html',
  'offline/index.html'
];

for (const file of requiredStatic) {
  const fullP = path.join(vercelOutput, 'static', file);
  assert(fs.existsSync(fullP), `Required static artifact built: ${file}`);
}

const requiredFunctions = [
  '_functions/entry.mjs',
  '_functions/pages/admin.astro.mjs',
  '_functions/pages/_slug_.astro.mjs',
  '_functions/pages/index.astro.mjs',
  '_functions/pages/search.astro.mjs',
  '_functions/pages/api/posts.astro.mjs',
  '_functions/pages/api/avatar.astro.mjs'
];

for (const fn of requiredFunctions) {
  const fullFn = path.join(vercelOutput, fn);
  assert(fs.existsSync(fullFn), `Required serverless function built: ${fn}`);
}

// 3. Author Studio Direct Workspace & 6 Authentic Tabs Test
console.log('\n✍️ 3. AUTHOR STUDIO DIRECT WORKSPACE & 6 AUTHENTIC TABS VERIFICATION:');
const adminSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin.astro'), 'utf-8');
assert(!adminSrc.includes('id="pin-screen"'), 'Admin studio has removed PIN barrier per user directive');
assert(adminSrc.includes('id="studio-screen"'), 'Admin studio has direct studio-screen container');
assert(adminSrc.includes('delete-post-btn'), 'Explorer tab contains delete-post-btn buttons');
assert(adminSrc.includes('load-in-writer-btn'), 'Explorer tab contains load-in-writer-btn buttons');
assert(adminSrc.includes('id="toolbar-add-footnote-btn"'), 'Writer tab contains footnote insertion toolbar button');
assert(adminSrc.includes('id="writer-footnotes-list"'), 'Writer tab contains dynamic footnotes management list');
assert(adminSrc.includes('id="save-publish-btn"'), 'Writer tab contains save & publish button');
assert(adminSrc.includes('id="tab-menu"'), 'Category & folder manager tab (tab-menu) is present');
assert(adminSrc.includes('id="tab-bookshelf"'), 'Bookshelf management tab (tab-bookshelf) is present');
assert(adminSrc.includes('id="tab-profile"'), 'Author profile editor tab (tab-profile) is present');
assert(adminSrc.includes('id="tab-settings"'), 'System status settings tab (tab-settings) is present');

// 3a. Public Viewer Cleanliness Verification
console.log('\n✨ 3a. PUBLIC VIEWER APP PURITY VERIFICATION (ZERO LOCKS/ADMIN TRACES):');
const publicHeader = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Header.astro'), 'utf-8');
const publicFooter = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Footer.astro'), 'utf-8');
assert(!publicHeader.includes('href="/admin"'), 'Public Header contains NO admin link');
assert(!publicFooter.includes('href="/admin"'), 'Public Footer contains NO admin link');

// 3b. Bookshelf Two Rooms Verification
console.log('\n📚 3b. BOOKSHELF TWO ROOMS VERIFICATION:');
const bookshelfSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/bookshelf.astro'), 'utf-8');
assert(bookshelfSrc.includes('id="btn-room-read"'), 'Bookshelf contains Room 1 Read Books button');
assert(bookshelfSrc.includes('id="btn-room-wish"'), 'Bookshelf contains Room 2 Wishlist button');
assert(bookshelfSrc.includes('id="room-read"'), 'Bookshelf contains Room 1 read container');
assert(bookshelfSrc.includes('id="room-wish"'), 'Bookshelf contains Room 2 wishlist container');

// 4. Gemini Live Digital Chronometer & Header Verification
console.log('\n⏰ 4. GEMINI LIVE CHRONOMETER & HEADER WIDGET VERIFICATION:');
const headerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Header.astro'), 'utf-8');
assert(headerSrc.includes('GEMINI LIVE'), 'Header contains GEMINI LIVE glowing badge');
assert(headerSrc.includes('gemini-live-date'), 'Header contains live date element (gemini-live-date)');
assert(headerSrc.includes('gemini-clock-hours'), 'Header contains digital clock hours element');
assert(headerSrc.includes('gemini-clock-minutes'), 'Header contains digital clock minutes element');
assert(headerSrc.includes('gemini-clock-seconds'), 'Header contains ticking seconds neon element');
assert(headerSrc.includes('gemini-clock-period'), 'Header contains AM/PM period element');
assert(headerSrc.includes('updateGeminiClock'), 'Header contains ticking clock engine script');
assert(headerSrc.includes('theme-toggle-btn'), 'Header contains Theme Toggle button (Day, Sepia, Night)');
assert(headerSrc.includes('lang-toggle-btn'), 'Header contains Language Toggle button (বাং / EN)');

// 5. Mobile Canvas Avatar Compressor & Modal Verification
console.log('\n📷 5. MOBILE AVATAR FIX & CANVAS COMPRESSOR VERIFICATION:');
const avatarSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AvatarModal.astro'), 'utf-8');
assert(avatarSrc.includes('id="avatar-modal"'), 'Avatar Modal is rendered on page');
assert(avatarSrc.includes('avatar-file-input'), 'Device photo file input is present');
assert(avatarSrc.includes('kherokhata_storage_v1'), 'IndexedDB storage layer is present for mobile durability');
assert(avatarSrc.includes('kherokhata_author_avatar'), 'LocalStorage author avatar sync is present');
assert(avatarSrc.includes('toDataURL'), 'Canvas auto-compression engine is present');

// 6. Frontpage Author Bio & Bookshelf Showcase Verification
console.log('\n👤 6. FRONTPAGE AUTHOR BIO & BOOKSHELF SHOWCASE VERIFICATION:');
const indexSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/index.astro'), 'utf-8');
assert(indexSrc.includes('id="author-intro-card"'), 'Homepage contains Author Intro & Bio Card (author-intro-card)');
assert(indexSrc.includes('author-name-text'), 'Homepage author card contains author-name-text');
assert(indexSrc.includes('author-shortbio-text'), 'Homepage author card contains author-shortbio-text');
assert(indexSrc.includes('href="/about"'), 'Homepage author card contains link to full about page');
assert(indexSrc.indexOf('id="author-intro-card"') < indexSrc.indexOf('id="spotlight-section"'), 'Author Bio card is positioned at the TOP before spotlight article');
assert(indexSrc.includes('id="home-bookshelf-section"'), 'Homepage contains Bookshelf Showcase Card (home-bookshelf-section)');
assert(indexSrc.includes('id="home-read-count"'), 'Homepage contains live Read Books counter (home-read-count)');
assert(indexSrc.includes('id="home-wish-count"'), 'Homepage contains live Wishlist counter (home-wish-count)');
assert(indexSrc.includes('href="/bookshelf"'), 'Homepage contains direct entrance link to full bookshelf');
assert(indexSrc.includes('id="categories"'), 'Homepage contains id="categories" section for smooth in-page category navigation');

// 7. Post Card Deletion Attributes Verification
console.log('\n🗑️ 7. POST DELETION CLIENT-SIDE SYNC VERIFICATION:');
assert(indexSrc.includes('data-slug='), 'Post items have data-slug attribute for client-side deletion sync');

// 8. Zero-Delay App Loader & Fast Dismiss Verification
console.log('\n🤖 8. ZERO-DELAY APP LOADER & FAST DISMISS VERIFICATION:');
const appLoaderSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AppLoader.astro'), 'utf-8');
assert(appLoaderSrc.includes('id="app-loader-screen"'), 'Layout contains full-screen AppLoader (app-loader-screen)');
assert(appLoaderSrc.includes("window.location.pathname.startsWith('/admin')"), 'AppLoader immediately bypasses on /admin to eliminate login buffering');
assert(appLoaderSrc.includes('kherokhata_session_active'), 'AppLoader skips on active browsing sessions for 0ms delay');

console.log('\n====================================================');
console.log(`📊 FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');
