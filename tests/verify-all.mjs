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

const initialPosts = getAllPosts();
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
const saveResult = savePost(testPost);
assert(saveResult === true, 'savePost() successfully creates new post in posts.json');
const afterSavePosts = getAllPosts();
assert(afterSavePosts.some((p) => p.slug === testSlug), 'Newly created post is queryable from posts.json');

// Test Delete
const deleteResult = deletePostBySlug(testSlug);
assert(deleteResult === true, 'deletePostBySlug() successfully removes post from posts.json');
const afterDeletePosts = getAllPosts();
assert(!afterDeletePosts.some((p) => p.slug === testSlug), 'Deleted post is permanently gone from posts.json');
assert(afterDeletePosts.length === initialPosts.length, 'Database post count accurately restored to initial state');

// Test Author DB
const author = getAuthor();
assert(author && author.name === 'আফফান লাবীব', 'Author details queryable from author.json');

// 2. Static Build Artifacts & Route Tests
console.log('\n📄 2. STATIC BUILD ARTIFACTS & HTML INTEGRITY TESTS:');
const distPath = path.resolve(process.cwd(), 'dist');
assert(fs.existsSync(distPath), 'Dist directory exists');

const requiredFiles = [
  'index.html',
  'admin/index.html',
  'about/index.html',
  'bookshelf/index.html',
  'search/index.html',
  'offline/index.html',
  'category/chinta/index.html',
  'category/pathalap/index.html',
  'category/itihas/index.html',
  'category/boi-alochona/index.html',
  'category/onubad/index.html',
  'sw.js',
  'manifest.webmanifest',
  'favicon.svg',
  'images/affan-labib.jpg'
];

for (const file of requiredFiles) {
  const fullP = path.join(distPath, file);
  assert(fs.existsSync(fullP), `Required artifact built: ${file}`);
}

// 3. Admin Studio Secret Security Guard & 6 Authentic Tabs Test
console.log('\n🔐 3. AUTHOR STUDIO PIN SECURITY & 6 AUTHENTIC TABS VERIFICATION:');
const adminHtml = fs.readFileSync(path.join(distPath, 'admin/index.html'), 'utf-8');
assert(adminHtml.includes('id="pin-screen"'), 'Admin studio has secret PIN screen security gate');
assert(adminHtml.includes('id="pin-input"'), 'Admin studio has pin-input field');
assert(adminHtml.includes('id="studio-screen"'), 'Admin studio has studio-screen container');
assert(adminHtml.includes('delete-post-btn'), 'Explorer tab contains delete-post-btn buttons');
assert(adminHtml.includes('load-in-writer-btn'), 'Explorer tab contains load-in-writer-btn buttons');
assert(adminHtml.includes('id="toolbar-add-footnote-btn"'), 'Writer tab contains footnote insertion toolbar button');
assert(adminHtml.includes('id="writer-footnotes-list"'), 'Writer tab contains dynamic footnotes management list');
assert(adminHtml.includes('id="save-publish-btn"'), 'Writer tab contains save & publish button');
assert(adminHtml.includes('id="tab-menu"'), 'Category & folder manager tab (tab-menu) is present');
assert(adminHtml.includes('id="tab-bookshelf"'), 'Bookshelf management tab (tab-bookshelf) is present');
assert(adminHtml.includes('id="tab-profile"'), 'Author profile editor tab (tab-profile) is present');
assert(adminHtml.includes('id="tab-settings"'), 'Security PIN settings tab (tab-settings) is present');

// 3b. Bookshelf Two Rooms Verification
console.log('\n📚 3b. BOOKSHELF TWO ROOMS VERIFICATION:');
const bookshelfHtml = fs.readFileSync(path.join(distPath, 'bookshelf/index.html'), 'utf-8');
assert(bookshelfHtml.includes('id="btn-room-read"'), 'Bookshelf contains Room 1 Read Books button');
assert(bookshelfHtml.includes('id="btn-room-wish"'), 'Bookshelf contains Room 2 Wishlist button');
assert(bookshelfHtml.includes('id="room-read"'), 'Bookshelf contains Room 1 read container');
assert(bookshelfHtml.includes('id="room-wish"'), 'Bookshelf contains Room 2 wishlist container');

// 4. Gemini Live Digital Chronometer & Header Verification
console.log('\n⏰ 4. GEMINI LIVE CHRONOMETER & HEADER WIDGET VERIFICATION:');
const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
assert(indexHtml.includes('GEMINI LIVE'), 'Header contains GEMINI LIVE glowing badge');
assert(indexHtml.includes('gemini-live-date'), 'Header contains live date element (gemini-live-date)');
assert(indexHtml.includes('gemini-clock-hours'), 'Header contains digital clock hours element');
assert(indexHtml.includes('gemini-clock-minutes'), 'Header contains digital clock minutes element');
assert(indexHtml.includes('gemini-clock-seconds'), 'Header contains ticking seconds neon element');
assert(indexHtml.includes('gemini-clock-period'), 'Header contains AM/PM period element');
assert(indexHtml.includes('updateGeminiClock'), 'Header contains ticking clock engine script');
assert(indexHtml.includes('theme-toggle-btn'), 'Header contains Theme Toggle button (Day, Sepia, Night)');
assert(indexHtml.includes('lang-toggle-btn'), 'Header contains Language Toggle button (বাং / EN)');

// 5. Mobile Canvas Avatar Compressor & Modal Verification
console.log('\n📷 5. MOBILE AVATAR FIX & CANVAS COMPRESSOR VERIFICATION:');
assert(indexHtml.includes('id="avatar-modal"'), 'Avatar Modal is rendered on page');
assert(indexHtml.includes('avatar-file-input'), 'Device photo file input is present');
assert(indexHtml.includes('kherokhata_storage_v1'), 'IndexedDB storage layer is present for mobile durability');
assert(indexHtml.includes('kherokhata_author_avatar'), 'LocalStorage author avatar sync is present');
assert(indexHtml.includes('toDataURL'), 'Canvas auto-compression engine is present');
assert(indexHtml.includes('author-avatar-img'), 'Global author avatar classes present across page');

// 6. Frontpage Author Bio & Bookshelf Showcase Verification
console.log('\n👤 6. FRONTPAGE AUTHOR BIO & BOOKSHELF SHOWCASE VERIFICATION:');
assert(indexHtml.includes('id="author-intro-card"'), 'Homepage contains Author Intro & Bio Card (author-intro-card)');
assert(indexHtml.includes('author-name-text'), 'Homepage author card contains author-name-text');
assert(indexHtml.includes('author-shortbio-text'), 'Homepage author card contains author-shortbio-text');
assert(indexHtml.includes('href="/about"'), 'Homepage author card contains link to full about page');
assert(indexHtml.indexOf('id="author-intro-card"') < indexHtml.indexOf('id="spotlight-section"'), 'Author Bio card is positioned at the TOP before spotlight article');
assert(indexHtml.includes('id="home-bookshelf-section"'), 'Homepage contains Bookshelf Showcase Card (home-bookshelf-section)');
assert(indexHtml.includes('id="home-read-count"'), 'Homepage contains live Read Books counter (home-read-count)');
assert(indexHtml.includes('id="home-wish-count"'), 'Homepage contains live Wishlist counter (home-wish-count)');
assert(indexHtml.includes('href="/bookshelf"'), 'Homepage contains direct entrance link to full bookshelf');
assert(indexHtml.includes('id="categories"'), 'Homepage contains id="categories" section for smooth in-page category navigation');

// 7. Post Card Deletion Attributes Verification
console.log('\n🗑️ 7. POST DELETION CLIENT-SIDE SYNC VERIFICATION:');
assert(indexHtml.includes('data-slug='), 'Post items have data-slug attribute for client-side deletion sync');
assert(indexHtml.includes('kherokhata_deleted_posts'), 'Index page checks deleted posts registry');

// 8. Ultra-Light App Loader & Pushing Robot Mascot Verification
console.log('\n🤖 8. ULTRA-LIGHT APP LOADER & PUSHING ROBOT MASCOT VERIFICATION:');
assert(indexHtml.includes('id="app-loader-screen"'), 'Layout contains full-screen AppLoader (app-loader-screen)');
assert(indexHtml.includes('id="loader-robot"'), 'AppLoader contains animated pushing robot mascot (loader-robot)');
assert(indexHtml.includes('id="loader-progress-bar"'), 'AppLoader contains dynamic progress bar (loader-progress-bar)');
assert(indexHtml.includes('id="loader-percent-badge"'), 'AppLoader contains live 1-100% counter badge (loader-percent-badge)');
assert(indexHtml.includes('id="loader-robot-emote"'), 'AppLoader contains robot speech emote bubble (loader-robot-emote)');

console.log('\n====================================================');
console.log(`📊 FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');
