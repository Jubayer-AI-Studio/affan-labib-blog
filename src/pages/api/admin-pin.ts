import type { APIRoute } from 'astro';
import { verifyAdminPinAsync, setAdminPinAsync, getAdminPinAsync, normalizeDigits } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const currentPin = await getAdminPinAsync();
    return new Response(
      JSON.stringify({
        success: true,
        hasCustomPin: currentPin !== '786992',
        pinConfigured: true
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
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body?.action || 'verify';

    // 1. Verify PIN
    if (action === 'verify') {
      const pin = normalizeDigits(body?.pin || '');
      if (!pin) {
        return new Response(
          JSON.stringify({ success: false, message: 'অনুগ্রহ করে পিন কোড লিখুন।' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const isValid = await verifyAdminPinAsync(pin);
      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, message: 'ভুল পিন কোড! শুধুমাত্র লেখকের নির্ধারিত পিন কোড দিয়েই খোলা যাবে।' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'পিন যাচাই সফল হয়েছে।',
          sessionTimestamp: Date.now()
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // 2. Change PIN
    if (action === 'change') {
      const newPin = normalizeDigits(body?.newPin || '');
      if (!newPin || newPin.length < 4) {
        return new Response(
          JSON.stringify({ success: false, message: 'নতুন পিন কোড কমপক্ষে ৪ ডিজিটের হতে হবে।' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // If currentPin is supplied, verify it
      if (body?.currentPin) {
        const cur = normalizeDigits(body.currentPin);
        const isCurValid = await verifyAdminPinAsync(cur);
        if (!isCurValid) {
          return new Response(
            JSON.stringify({ success: false, message: 'বর্তমান পিন কোড সঠিক নয়।' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      const saved = await setAdminPinAsync(newPin);
      if (!saved) {
        return new Response(
          JSON.stringify({ success: false, message: 'ক্লাউড ডেটাবেসে পিন কোড সংরক্ষণ ব্যর্থ হয়েছে।' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'নতুন পিন কোড ক্লাউড ডেটাবেসে সফলভাবে সংরক্ষিত হয়েছে!'
        }),
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
      JSON.stringify({ success: false, message: 'Unknown action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
