// src/lib/events/fetchSerpApi.ts
// SerpApi Google Events：按城市名拉演出（Google 聚合全网，含 Dice/RA 等地下场次）。
// 服务端专用。需 .env.local: SERPAPI_API_KEY
//
// 已知数据形态（与 TM 的差异，代码里都已处理）：
//  - 日期不带年份（"Aug 30"）→ 推断：该日期今年已过则算明年
//  - 场馆只有名字没坐标 → 由调用方用 venueGeocode 补（本文件不调，保持纯拉取）
//  - 无 genre 字段 → genre 置 null（feed 里只出现在"全部"，不进 genre 筛选）
//  - ticket_info 多票源并列 → 全部保留进 sources

import type { RawEvent } from '@/lib/events/fetchTicketmaster';

const SERP_ENDPOINT = 'https://serpapi.com/search.json';

export interface SourceLink {
  source: string;
  url: string;
  price_min: number | null;
}

export interface SerpEvent extends RawEvent {
  source_links: SourceLink[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "Aug 30" / "Dec 5" -> "YYYY-MM-DD"（今年已过则算明年）；解析失败返回 null */
export function inferEventDate(startDate: string | undefined): string | null {
  if (!startDate) return null;
  const m = startDate.trim().match(/^([A-Za-z]{3,})\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  const day = parseInt(m[2], 10);
  if (!month || !day || day > 31) return null;

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  // 已过去超过 2 天 → 是明年的（candidate 是当天 00:00，48h 余量罩住"昨天"+时区差）
  if (candidate.getTime() < now.getTime() - 48 * 3600 * 1000) year += 1;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** 从 "Sat 6:00 PM" / when 字段抠时间 -> "18:00:00"；抠不到返回 null */
function extractTime(when: string | undefined): string | null {
  if (!when) return null;
  const m = when.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}:00`;
}

/** 稳定哈希（同一演出跨同步生成相同 id），无依赖的简易 djb2 */
export function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * 按城市拉 Google Events。
 * @param cityName 城市显示名（如 "Los Angeles"）
 * @param queries  搜索词模板（{city} 会被替换）。默认两条：泛音乐 + 电子乐。
 * @param pagesPerQuery 每条 query 翻几页（每页 10 条，每页 1 次额度）
 */
export async function fetchSerpApiEvents(
  cityName: string,
  queries: string[] = ['concerts in {city}', 'edm events in {city}'],
  pagesPerQuery: number = 2
): Promise<SerpEvent[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    console.warn('[serpapi] SERPAPI_API_KEY 未配置，跳过 SerpApi 源');
    return [];
  }

  const out: SerpEvent[] = [];

  for (const tpl of queries) {
    const q = tpl.replace('{city}', cityName);
    for (let page = 0; page < pagesPerQuery; page++) {
      const params = new URLSearchParams({
        engine: 'google_events',
        q,
        hl: 'en',
        api_key: key,
      });
      if (page > 0) params.set('start', String(page * 10));

      let json: any;
      try {
        const res = await fetch(`${SERP_ENDPOINT}?${params.toString()}`);
        json = await res.json();
      } catch (e) {
        console.error('[serpapi] fetch 失败', q, e);
        break;
      }

      const results = json?.events_results ?? [];
      if (!results.length) break; // 没有更多页了

      for (const e of results) {
        const eventDate = inferEventDate(e?.date?.start_date);
        if (!eventDate) continue; // 没日期的没法去重也没法展示，丢弃

        const venue =
          typeof e.venue === 'string' ? e.venue : e.venue?.name ?? '';
        const title = (e.title ?? '').trim();
        if (!title) continue;

        // 多票源
        const links: SourceLink[] = (e.ticket_info ?? [])
          .filter((t: any) => t?.link)
          .map((t: any) => ({
            source: (t.source ?? 'unknown').toLowerCase(),
            url: t.link,
            price_min:
              typeof t.extracted_price === 'number' ? t.extracted_price : null,
          }));
        if (!links.length && e.link) {
          links.push({ source: 'google_events', url: e.link, price_min: null });
        }

        const priceMin =
          typeof e.extracted_price === 'number'
            ? e.extracted_price
            : links.find((l) => l.price_min != null)?.price_min ?? null;

        out.push({
          // 稳定 id：serp: + hash(标题|场馆|日期)
          tm_id: `serp:${stableHash(
            `${title.toLowerCase()}|${venue.toLowerCase()}|${eventDate}`
          )}`,
          artist: title, // Google Events 的 title 通常就是艺人/演出名
          venue,
          city: cityName,
          lat: null, // 由聚合层用 venueGeocode 补
          lng: null,
          event_date: eventDate,
          event_time: extractTime(e?.date?.when),
          price_min: priceMin,
          price_max: null,
          genre: null, // Google Events 无 genre
          cover_url: e.thumbnail ?? null,
          ticket_url: links[0]?.url ?? null,
          description: e.description ?? null,
          source_links: links,
        });
      }

      if (results.length < 10) break; // 不满一页 = 最后一页
    }
  }

  return out;
}
