// src/lib/events/aggregate.ts
// 聚合编排：一个目标城市/坐标 → 拉 TM + SerpApi → 补 serp 场馆坐标 → 去重合并。
// sync-events 和 refresh-city-events 都调这个，逻辑只写一份。

import { fetchTicketmasterByGeo } from '@/lib/events/fetchTicketmaster';
import { fetchSerpApiEvents } from '@/lib/events/fetchSerpApi';
import { geocodeVenue } from '@/lib/geo/venueGeocode';
import { mergeBatches, type MergedEvent } from '@/lib/events/dedupe';

export interface AggregateTarget {
  lat: number;
  lng: number;
  radius_km: number;
  display_name: string; // SerpApi 按城市名搜，必须有
}

export interface AggregateResult {
  rows: MergedEvent[];
  absorbedSerpIds: string[];
  counts: { tm: number; serp: number; merged: number };
}

export async function aggregateEventsForTarget(
  t: AggregateTarget
): Promise<AggregateResult> {
  // 两源并行拉
  const [tmEvents, serpEvents] = await Promise.all([
    fetchTicketmasterByGeo(t.lat, t.lng, t.radius_km),
    t.display_name
      ? fetchSerpApiEvents(t.display_name)
      : Promise.resolve([]),
  ]);

  // 给 serp 事件补场馆坐标（带缓存，同场馆只 geocode 一次；
  // 串行跑避免并发打爆 Google 配额——一个城市的独立场馆通常就几十个，且大多命中缓存）
  for (const se of serpEvents) {
    if (se.venue && (se.lat == null || se.lng == null)) {
      const coords = await geocodeVenue(se.venue, t.display_name);
      se.lat = coords.lat;
      se.lng = coords.lng;
    }
  }

  const { merged, absorbedSerpIds } = mergeBatches(tmEvents, serpEvents);

  return {
    rows: merged,
    absorbedSerpIds,
    counts: { tm: tmEvents.length, serp: serpEvents.length, merged: merged.length },
  };
}
