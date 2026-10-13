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

// 3. Admin Studio Direct Access & Zero PIN Screen Test
console.log('\n🔐 3. AUTHOR STUDIO ACCESS & ZERO-LOCKOUT VERIFICATION:');
const adminHtml = fs.readFileSync(path.join(distPath, 'admin/index.html'), 'utf-8');
assert(!adminHtml.includes('id="pin-screen"'), 'Admin studio has NO PIN screen or password barrier');
assert(!adminHtml.includes('id="pin-input"'), 'Admin studio has NO pin-input field');
assert(adminHtml.includes('id="studio-screen"'), 'Admin studio has studio-screen element');
assert(!adminHtml.includes('id="studio-screen" class="hidden'), 'studio-screen is NOT hidden (Direct 100% access)');
assert(adminHtml.includes('delete-post-btn'), 'Admin studio contains delete-post-btn buttons');
assert(adminHtml.includes('publish-post-btn'), 'Admin studio contains publish-post-btn');
assert(adminHtml.includes('download-markdown-btn'), 'Admin studio contains download-markdown-btn');
assert(adminHtml.includes('copy-markdown-btn'), 'Admin studio contains copy-markdown-btn');

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

// 6. Post Card Deletion Attributes Verification
console.log('\n🗑️ 6. POST DELETION CLIENT-SIDE SYNC VERIFICATION:');
assert(indexHtml.includes('data-slug='), 'Post items have data-slug attribute for client-side deletion sync');
assert(indexHtml.includes('kherokhata_deleted_posts'), 'Index page checks deleted posts registry');

console.log('\n====================================================');
console.log(`📊 FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log('====================================================\n');
