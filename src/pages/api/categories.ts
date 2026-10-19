// src/pages/api/categories.ts
// Serverless API for Dynamic Folder / Category Management
import type { APIRoute } from 'astro';
import { getCategoriesAsync, saveCategory, deleteCategory } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const categories = await getCategoriesAsync();
    return new Response(JSON.stringify({ success: true, categories }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body || !body.title) {
      return new Response(
        JSON.stringify({ success: false, message: 'বিভাগের নাম আবশ্যক' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Auto-generate slug if not provided
    const id = (body.id || body.title)
      .toLowerCase()
      .trim()
      .replace(/[^\w\u0980-\u09FF-]+/g, '-')
      .replace(/^-+|-+$/g, '') || ('cat-' + Date.now());

    const newCategory = {
      id,
      title: body.title.trim(),
      desc: (body.desc || '').trim(),
      icon: body.icon || '📁'
    };

    const saved = await saveCategory(newCategory);
    if (!saved) {
      return new Response(
        JSON.stringify({ success: false, message: 'বিভাগ সংরক্ষণ ব্যর্থ হয়েছে' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, category: newCategory }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body || !body.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'বিভাগের আইডি আবশ্যক' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const deleted = await deleteCategory(body.id);
    if (!deleted) {
      return new Response(
        JSON.stringify({ success: false, message: 'মূল ডিফল্ট বিভাগ ডিলিট করা সম্ভব নয় অথবা পাওয়া যায়নি' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, message: 'বিভাগ সফলভাবে মুছে ফেলা হয়েছে' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
