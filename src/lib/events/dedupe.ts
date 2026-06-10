// src/lib/events/dedupe.ts
// 多源去重合并：判断"两条记录是不是同一场演出"，TM 优先合并。
//
// 判同规则（必须同时满足）：
//   1. 同一天（event_date 相等）
//   2. 同一场馆：坐标距离 < 250 米，或归一化场馆名相同/包含
//   3. 艺人/标题近似：词级重叠率 >= 0.5，或一方包含另一方
//
// 合并策略（TM 为主记录）：
//   - 字段以 TM 为准（坐标/genre/封面/价格都更干净）
//   - SerpApi 的多票源链接并进 sources（去掉与 TM 重复的 ticketmaster 链接）
//   - TM 缺 description 而 Serp 有 → 补上

import type { RawEvent } from '@/lib/events/fetchTicketmaster';
import type { SerpEvent, SourceLink } from '@/lib/events/fetchSerpApi';

export interface MergedEvent extends RawEvent {
  sources: SourceLink[];
}

/** 归一化：小写、去标点、压空格 */
export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 两点距离（米），Haversine */
export function distanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 词级重叠率：交集 / 较小集合 */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' ').filter(Boolean));
  const tb = new Set(normalize(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size);
}

/** 场馆是否同一个 */
function sameVenue(a: RawEvent, b: RawEvent): boolean {
  // 坐标都有 → 距离判定（250m 容差吸收 geocode 误差）
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    if (distanceMeters(a.lat, a.lng, b.lat, b.lng) < 250) return true;
  }
  // 名字判定：相等或互相包含（"The Forum" vs "Kia Forum" 这类靠包含兜不住，
  // 但坐标判定会兜住；名字判定兜 geocode 失败的情况）
  const na = normalize(a.venue);
  const nb = normalize(b.venue);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** 艺人/标题是否近似 */
function similarArtist(a: RawEvent, b: RawEvent): boolean {
  const na = normalize(a.artist);
  const nb = normalize(b.artist);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  return tokenOverlap(na, nb) >= 0.5;
}

/** 是否同一场演出 */
export function isSameEvent(a: RawEvent, b: RawEvent): boolean {
  if (!a.event_date || !b.event_date || a.event_date !== b.event_date)
    return false;
  return sameVenue(a, b) && similarArtist(a, b);
}

/**
 * 合并一批 TM 事件 + 一批 Serp 事件。
 * 返回：{ merged: 最终写库行, absorbedSerpIds: 被 TM 吸收的 serp tm_id（用于清理 DB 旧行） }
 */
export function mergeBatches(
  tmEvents: RawEvent[],
  serpEvents: SerpEvent[]
): { merged: MergedEvent[]; absorbedSerpIds: string[] } {
  const merged: MergedEvent[] = tmEvents.map((e) => ({
    ...e,
    sources: [
      {
        source: 'ticketmaster',
        url: e.ticket_url ?? '',
        price_min: e.price_min,
      },
    ].filter((s) => s.url) as SourceLink[],
  }));

  const absorbedSerpIds: string[] = [];

  for (const se of serpEvents) {
    const hit = merged.find((m) => isSameEvent(m, se));
    if (hit) {
      // 吸收：把 serp 的非 TM 票源并进去（按 url 去重）
      const existingUrls = new Set(hit.sources.map((s) => s.url));
      for (const link of se.source_links) {
        if (link.source === 'ticketmaster') continue; // TM 链接已有官方版
        if (!existingUrls.has(link.url)) {
          hit.sources.push(link);
          existingUrls.add(link.url);
        }
      }
      if (!hit.description && se.description) hit.description = se.description;
      absorbedSerpIds.push(se.tm_id);
    } else {
      // TM 没有的独家场次（地下场子大多走这）→ 独立成行
      const { source_links, ...rest } = se;
      merged.push({ ...rest, sources: source_links });
    }
  }

  return { merged, absorbedSerpIds };
}
