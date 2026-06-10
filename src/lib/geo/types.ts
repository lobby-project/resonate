// src/lib/geo/types.ts
// 位置 = 前端视图状态，不落 users 表。
// v2 更新：ActiveLocation 加 query_key（place_id 或预设城市键），
// refreshCityEvents 把它传给后端做 12 小时阈值判断。

export interface ActiveLocation {
  display_name: string; // 给用户看的城市名，如 "Los Angeles"
  lat: number;
  lng: number;
  radius_km: number;
  query_key?: string;   // place_id（搜索来的）或预设城市键（如 'los angeles'）
}

// LA 兜底（理论上用不到——onboarding 拿不到定位会让用户搜索；留个最终保险）
export const FALLBACK_LOCATION: ActiveLocation = {
  display_name: 'Los Angeles',
  lat: 34.0522,
  lng: -118.2437,
  radius_km: 40,
  query_key: 'los angeles',
};

// 选定位置后触发该城市演出同步（带 12 小时阈值；secret 留服务端）
export async function refreshCityEvents(loc: ActiveLocation): Promise<void> {
  try {
    await fetch('/api/refresh-city-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: loc.lat,
        lng: loc.lng,
        radius_km: loc.radius_km,
        city: loc.display_name,
        query_key: loc.query_key ?? null,
      }),
    });
  } catch (e) {
    console.warn('[refreshCityEvents] 触发同步失败', e);
  }
}
