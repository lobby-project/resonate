// src/app/api/places-autocomplete/route.ts
// 边打字边出候选城市。前端调，服务端执行。
// 用 Google Places Autocomplete (Legacy)，types=(cities) 只出城市级结果。
// 测试：GET /api/places-autocomplete?q=new
//
// 返回：{ predictions: [{ place_id, description }] }
//   place_id 拿去 /api/place-coords 换坐标。

import { NextRequest, NextResponse } from 'next/server';

const ENDPOINT =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    // 太短不查，省调用
    return NextResponse.json({ predictions: [] });
  }

  // 复用同一个 Google key（已启用 Geocoding + Places）
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    console.error('[autocomplete] GOOGLE_GEOCODING_API_KEY 未配置');
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }

  const url =
    `${ENDPOINT}?input=${encodeURIComponent(q)}` +
    `&types=(cities)` + // 只出城市级
    `&key=${key}`;

  try {
    const res = await fetch(url);
    const json: any = await res.json();

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      console.warn('[autocomplete] status', json.status, json.error_message);
      return NextResponse.json({ predictions: [] });
    }

    const predictions = (json.predictions ?? []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description, // 如 "New York, NY, USA"
    }));

    return NextResponse.json({ predictions });
  } catch (e) {
    console.error('[autocomplete] fetch 失败', e);
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }
}
