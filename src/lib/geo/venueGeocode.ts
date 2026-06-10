// src/lib/geo/venueGeocode.ts
// 场馆名 -> 坐标，带 Supabase 缓存（venue_geocache 表）。服务端专用。
// SerpApi 的演出只有场馆名没坐标，用这个补坐标；同一场馆只调一次 Google。
// geocode 失败也写缓存（lat/lng=null），避免对烂名字反复烧调用。

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface VenueCoords {
  lat: number | null;
  lng: number | null;
}

export async function geocodeVenue(
  venueName: string,
  city: string
): Promise<VenueCoords> {
  const name = venueName.trim();
  if (!name) return { lat: null, lng: null };

  const queryKey = `${name.toLowerCase()}|${city.trim().toLowerCase()}`;

  // 1) 查缓存（包括失败缓存）
  const { data: cached } = await supabaseAdmin
    .from('venue_geocache')
    .select('lat, lng')
    .eq('query_key', queryKey)
    .maybeSingle();

  if (cached) return { lat: cached.lat, lng: cached.lng };

  // 2) 调 Google：用 "场馆名, 城市" 提高命中率
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) return { lat: null, lng: null };

  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const url =
      `${ENDPOINT}?address=${encodeURIComponent(`${name}, ${city}`)}` +
      `&key=${key}`;
    const res = await fetch(url);
    const json: any = await res.json();
    const loc = json?.results?.[0]?.geometry?.location;
    if (json.status === 'OK' && loc) {
      lat = loc.lat;
      lng = loc.lng;
    }
  } catch (e) {
    console.warn('[venueGeocode] fetch 失败', name, e);
  }

  // 3) 成败都写缓存
  await supabaseAdmin.from('venue_geocache').upsert(
    { query_key: queryKey, venue_name: name, city, lat, lng },
    { onConflict: 'query_key' }
  );

  return { lat, lng };
}
