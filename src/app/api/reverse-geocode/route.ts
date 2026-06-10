// src/app/api/reverse-geocode/route.ts
// onboarding 自动定位拿到坐标后，反查城市显示名（让右上角能显示 "Los Angeles" 而非一串经纬度）。
// 用 Google Geocoding 反向查询。前端调，服务端执行。
// 测试：GET /api/reverse-geocode?lat=34.0522&lng=-118.2437
//
// 返回：{ display_name, lat, lng, radius_km }

import { NextRequest, NextResponse } from 'next/server';

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_RADIUS_KM = 40;

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get('lat'));
  const lng = Number(sp.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'invalid_coords' }, { status: 400 });
  }

  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'no_key' }, { status: 500 });
  }

  // result_type=locality 优先拿"城市"级名字
  const url =
    `${ENDPOINT}?latlng=${lat},${lng}` +
    `&result_type=locality` +
    `&key=${key}`;

  try {
    const res = await fetch(url);
    const json: any = await res.json();

    let displayName = '';
    if (json.status === 'OK' && json.results?.length) {
      // 取 locality 组件作为城市名；取不到就用 formatted_address
      const comp = json.results[0].address_components?.find((c: any) =>
        c.types?.includes('locality')
      );
      displayName =
        comp?.long_name || json.results[0].formatted_address || '';
    }

    return NextResponse.json({
      display_name: displayName || '我的位置',
      lat,
      lng,
      radius_km: DEFAULT_RADIUS_KM,
    });
  } catch (e) {
    console.error('[reverse-geocode] fetch 失败', e);
    // 失败也返回坐标，至少能用，名字给个占位
    return NextResponse.json({
      display_name: '我的位置',
      lat,
      lng,
      radius_km: DEFAULT_RADIUS_KM,
    });
  }
}
