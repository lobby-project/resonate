// src/app/api/refresh-city-events/route.ts
// 切城市触发的按需同步（多源聚合版），保留 12 小时阈值。
// SYNC_SECRET 不暴露前端。POST body: { lat, lng, radius_km, city, query_key? }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aggregateEventsForTarget } from '@/lib/events/aggregate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const STALE_HOURS = 12;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const radiusKm = Number(body?.radius_km ?? 40);
  const city = typeof body?.city === 'string' ? body.city : '';
  const queryKey =
    typeof body?.query_key === 'string' && body.query_key.trim()
      ? body.query_key.trim()
      : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'invalid_coords' }, { status: 400 });
  }

  // 12 小时阈值
  if (queryKey) {
    const { data: c } = await supabaseAdmin
      .from('cities')
      .select('last_synced_at')
      .eq('query_key', queryKey)
      .maybeSingle();
    if (c?.last_synced_at) {
      const ageMs = Date.now() - new Date(c.last_synced_at).getTime();
      if (ageMs < STALE_HOURS * 3600 * 1000) {
        return NextResponse.json({ ok: true, skipped: true, synced: 0 });
      }
    }
  }

  try {
    const { rows, absorbedSerpIds, counts } = await aggregateEventsForTarget({
      lat,
      lng,
      radius_km: radiusKm,
      display_name: city,
    });

    if (rows.length) {
      const dbRows = rows.map((r) => ({ ...r, city: r.city ?? city }));
      const { error } = await supabaseAdmin
        .from('events')
        .upsert(dbRows, { onConflict: 'tm_id' });
      if (error) {
        console.error('[refresh-city-events] upsert 失败', error);
        return NextResponse.json({ error: 'db' }, { status: 500 });
      }
    }

    if (absorbedSerpIds.length) {
      await supabaseAdmin.from('events').delete().in('tm_id', absorbedSerpIds);
    }

    if (queryKey) {
      await supabaseAdmin
        .from('cities')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('query_key', queryKey);
    }

    return NextResponse.json({ ok: true, skipped: false, ...counts });
  } catch (e) {
    console.error('[refresh-city-events] 聚合失败', e);
    return NextResponse.json({ error: 'aggregate' }, { status: 500 });
  }
}
