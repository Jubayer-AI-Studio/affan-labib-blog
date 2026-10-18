-- ================================================================
-- সুপাবেজ (Supabase) ডাটাবেজ স্কিমা ও মাইগ্রেশন স্ক্রিপ্ট
-- প্রজেক্ট: আফফান লাবীব সাহিত্যিক ব্লগ (affan-labib-blog-v2)
-- ================================================================

-- ১. posts টেবিল তৈরি
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    published_at TEXT NOT NULL,
    formatted_date TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    body TEXT NOT NULL,
    word_count INT DEFAULT 0,
    footnotes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ইডেক্স তৈরি (দ্রুত অনুসন্ধানের জন্য)
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);

-- ২. author_profile টেবিল তৈরি
CREATE TABLE IF NOT EXISTS public.author_profile (
    id INT PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ৩. bookshelf টেবিল তৈরি
CREATE TABLE IF NOT EXISTS public.bookshelf (
    id INT PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) পলিসি
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookshelf ENABLE ROW LEVEL SECURITY;

-- যেকোনো ভিজিটর পোস্ট ও প্রোফাইল পড়তে পারবেন (Public Read)
CREATE POLICY "Public Read Posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Public Read Author" ON public.author_profile FOR SELECT USING (true);
CREATE POLICY "Public Read Bookshelf" ON public.bookshelf FOR SELECT USING (true);

-- লেখক স্টুডিও থেকে পোস্ট ইনসার্ট, আপডেট ও ডিলিট করার অনুমতি
CREATE POLICY "Allow All Insert Posts" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update Posts" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete Posts" ON public.posts FOR DELETE USING (true);

CREATE POLICY "Allow All Insert Author" ON public.author_profile FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update Author" ON public.author_profile FOR UPDATE USING (true);

CREATE POLICY "Allow All Insert Bookshelf" ON public.bookshelf FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update Bookshelf" ON public.bookshelf FOR UPDATE USING (true);
