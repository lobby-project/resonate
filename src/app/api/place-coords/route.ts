// src/app/api/place-coords/route.ts
// 用户点中某个候选城市后，用它的 place_id 换坐标。前端调，服务端执行。
// 用 Google Place Details (Legacy)，只取 geometry + name，省费用。
// 同时写入 cities 缓存（query_key=place_id），下次同城直接命中。
// 测试：GET /api/place-coords?place_id=ChIJ...
//
// 返回：{ display_name, lat, lng, radius_km }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json';
const DEFAULT_RADIUS_KM = 40;

export async function GET(req: NextRequest) {
  const placeId = new URL(req.url).searchParams.get('place_id')?.trim() ?? '';
  if (!placeId) {
    return NextResponse.json({ error: 'empty' }, { status: 400 });
  }

  // 1) 查缓存（用 place_id 当 query_key）
  const { data: cached } = await supabaseAdmin
    .from('cities')
    .select('display_name, lat, lng, radius_km')
    .eq('query_key', placeId)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      query_key: placeId,
      display_name: cached.display_name,
      lat: cached.lat,
      lng: cached.lng,
      radius_km: cached.radius_km ?? DEFAULT_RADIUS_KM,
    });
  }

  // 2) 未命中：调 Place Details
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    console.error('[place-coords] GOOGLE_GEOCODING_API_KEY 未配置');
    return NextResponse.json({ error: 'no_key' }, { status: 500 });
  }

  const url =
    `${ENDPOINT}?place_id=${encodeURIComponent(placeId)}` +
    `&fields=geometry,name,formatted_address` +
    `&key=${key}`;

  let json: any;
  try {
    const res = await fetch(url);
    json = await res.json();
  } catch (e) {
    console.error('[place-coords] fetch 失败', e);
    return NextResponse.json({ error: 'fetch' }, { status: 500 });
  }

  if (json.status !== 'OK' || !json.result?.geometry?.location) {
    console.warn('[place-coords] 无结果', json.status);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const loc = json.result.geometry.location;
  const result = {
    query_key: placeId,
    display_name: json.result.name || json.result.formatted_address || '',
    lat: loc.lat,
    lng: loc.lng,
    radius_km: DEFAULT_RADIUS_KM,
  };

  // 3) 写缓存（失败不阻塞）
  await supabaseAdmin.from('cities').upsert(
    {
      query_key: placeId,
      display_name: result.display_name,
      lat: result.lat,
      lng: result.lng,
      radius_km: result.radius_km,
      is_preset: false,
    },
    { onConflict: 'query_key' }
  );

  return NextResponse.json(result);
}
