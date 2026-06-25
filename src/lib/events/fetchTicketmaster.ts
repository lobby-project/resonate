// src/lib/events/fetchTicketmaster.ts
// 按坐标拉取 Ticketmaster 音乐演出。服务端使用。
// 依赖：npm install ngeohash
//
// ⚠️ API 细节（已核实）：
//  - TM 的 latlong 参数已被官方标记 deprecated，改用 geoPoint（geohash）。
//  - radius + unit(miles/km，默认 miles) 有效。
//  - 每个 event 自带场馆坐标 _embedded.venues[0].location，直接用，无需再 geocoding。

import geohash from 'ngeohash';

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';

// Pick the sharpest cover. Our poster frame is portrait (4:5) and TM images are
// mostly landscape, so cover-fit scales the image to the frame's HEIGHT — the
// image's height is what drives sharpness (a 1024×576 16:9 only has 576px of
// height and still upscales/blurs in a tall frame). So pick the tallest image,
// tie-breaking by width. This naturally prefers TM's portrait/RETINA variants
// when present. Events whose biggest source is small simply have no sharp image.
function pickCover(
  images?: { url: string; width?: number; height?: number }[]
): string | null {
  if (!images?.length) return null;
  return [...images].sort(
    (a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.width ?? 0) - (a.width ?? 0)
  )[0].url;
}

export interface RawEvent {
  tm_id: string;
  artist: string;
  venue: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  event_date: string | null; // YYYY-MM-DD
  event_time: string | null;
  price_min: number | null;
  price_max: number | null;
  genre: string | null; // 已映射为你们的 12 分类 Title Case
  cover_url: string | null;
  ticket_url: string | null;
  description: string | null;
}

/**
 * TM genre/segment 名 -> 你们锁定的 12 分类（Title Case）。
 * TM 返回的名称未必逐字一致，这里做归一。比较时小写无关。
 * 你们的 12 分类：
 *  Electronic / EDM · Hip-Hop / Rap · Pop · Rock · R&B / Soul · Jazz / Blues ·
 *  Indie / Alternative · Metal / Punk · Country / Folk · Latin · Reggae · Classical / Orchestra
 */
const GENRE_MAP: Record<string, string> = {
  'dance/electronic': 'Electronic / EDM',
  'electronic': 'Electronic / EDM',
  'edm': 'Electronic / EDM',
  'hip-hop/rap': 'Hip-Hop / Rap',
  'hip-hop': 'Hip-Hop / Rap',
  'rap': 'Hip-Hop / Rap',
  'r&b': 'R&B / Soul',
  'rhythm & blues': 'R&B / Soul',
  'soul': 'R&B / Soul',
  'pop': 'Pop',
  'rock': 'Rock',
  'jazz': 'Jazz / Blues',
  'blues': 'Jazz / Blues',
  'alternative': 'Indie / Alternative',
  'indie': 'Indie / Alternative',
  'metal': 'Metal / Punk',
  'punk': 'Metal / Punk',
  'hard rock': 'Metal / Punk',
  'country': 'Country / Folk',
  'folk': 'Country / Folk',
  'latin': 'Latin',
  'reggae': 'Reggae',
  'classical': 'Classical / Orchestra',
  'orchestra': 'Classical / Orchestra',
};

function mapGenre(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (GENRE_MAP[key]) return GENRE_MAP[key];
  // 模糊兜底：包含匹配
  for (const k of Object.keys(GENRE_MAP)) {
    if (key.includes(k)) return GENRE_MAP[k];
  }
  return null; // 映射不到就留空，别硬塞
}

/**
 * 按坐标拉取音乐演出。
 * @param lat 中心纬度
 * @param lng 中心经度
 * @param radiusKm 半径（公里）
 */
export async function fetchTicketmasterByGeo(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<RawEvent[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) throw new Error('TICKETMASTER_API_KEY 未配置');

  // geoPoint 用 9 位 geohash（足够精确）
  const geoPoint = geohash.encode(lat, lng, 9);

  const params = new URLSearchParams({
    apikey: key,
    geoPoint,
    radius: String(radiusKm),
    unit: 'km',
    classificationName: 'music',
    sort: 'date,asc',
    size: '100', // 每页最多 100；需要更多做分页(加 page 参数)
  });

  const res = await fetch(`${TM_BASE}?${params.toString()}`);
  if (!res.ok) {
    console.error('[tm] 请求失败', res.status);
    return [];
  }
  const json: any = await res.json();
  const events = json?._embedded?.events ?? [];

  return events.map((e: any): RawEvent => {
    const venue = e._embedded?.venues?.[0];
    const loc = venue?.location;
    const priceRange = e.priceRanges?.[0];
    const rawGenre =
      e.classifications?.[0]?.genre?.name ??
      e.classifications?.[0]?.segment?.name ??
      null;

    return {
      tm_id: e.id,
      artist: e.name,
      venue: venue?.name ?? '',
      city: venue?.city?.name ?? null,
      lat: loc?.latitude ? parseFloat(loc.latitude) : null,
      lng: loc?.longitude ? parseFloat(loc.longitude) : null,
      event_date: e.dates?.start?.localDate ?? null,
      event_time: e.dates?.start?.localTime ?? null,
      price_min: priceRange?.min ?? null,
      price_max: priceRange?.max ?? null,
      genre: mapGenre(rawGenre),
      cover_url: pickCover(e.images),
      ticket_url: e.url ?? null,
      description: e.info ?? e.pleaseNote ?? null,
    };
  });
}
