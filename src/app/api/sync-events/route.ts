// src/app/api/sync-events/route.ts
// 多源聚合版同步。鉴权两种（任一通过）：?secret=SYNC_SECRET 或 Vercel Cron 的 Bearer CRON_SECRET。
// 不带坐标参数时同步所有预设城市，并更新 cities.last_synced_at。
// 手动测试：
//   GET /api/sync-events?secret=你的SYNC_SECRET
//   GET /api/sync-events?secret=...&lat=34.0522&lng=-118.2437&radius=40&city=Los%20Angeles

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aggregateEventsForTarget } from '@/lib/events/aggregate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface Target {
  lat: number;
  lng: number;
  radius_km: number;
  display_name: string;
  query_key?: string;
}

function isAuthorized(req: NextRequest, sp: URLSearchParams): boolean {
  if (sp.get('secret') === process.env.SYNC_SECRET) return true;
  const auth = req.headers.get('authorization');
  return !!(
    process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (!isAuthorized(req, searchParams)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  let targets: Target[] = [];
  if (latParam && lngParam) {
    targets = [
      {
        lat: parseFloat(latParam),
        lng: parseFloat(lngParam),
        radius_km: parseInt(searchParams.get('radius') ?? '40', 10),
        display_name: searchParams.get('city') ?? '',
      },
    ];
  } else {
    const { data: presets } = await supabaseAdmin
      .from('cities')
      .select('query_key, display_name, lat, lng, radius_km')
      .eq('is_preset', true);
    targets = (presets ?? []).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      radius_km: p.radius_km,
      display_name: p.display_name,
      query_key: p.query_key,
    }));
  }

  let total = 0;
  const detail: Record<string, unknown>[] = [];

  for (const t of targets) {
    try {
      const { rows, absorbedSerpIds, counts } =
        await aggregateEventsForTarget(t);

      if (rows.length) {
        const dbRows = rows.map((r) => ({ ...r, city: r.city ?? t.display_name }));
        const { error } = await supabaseAdmin
          .from('events')
          .upsert(dbRows, { onConflict: 'tm_id' });
        if (error) {
          console.error('[sync] upsert 失败', t.display_name, error);
          detail.push({ city: t.display_name, error: String(error.message) });
          continue;
        }
        total += dbRows.length;
      }

      // 清理：本批被 TM 吸收的 serp 行（之前同步可能单独写过）
      if (absorbedSerpIds.length) {
        await supabaseAdmin.from('events').delete().in('tm_id', absorbedSerpIds);
      }

      if (t.query_key) {
        await supabaseAdmin
          .from('cities')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('query_key', t.query_key);
      }

      detail.push({ city: t.display_name, ...counts });
    } catch (e) {
      console.error('[sync] 目标失败', t.display_name, e);
      detail.push({ city: t.display_name, error: String(e) });
    }
  }

  return NextResponse.json({ ok: true, synced: total, detail });
}
