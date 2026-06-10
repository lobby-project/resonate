// src/components/OnboardingLocation.tsx
// onboarding 的定位步骤：进来自动请求浏览器地理位置权限。
//  - 拿到坐标 -> 反查城市名 -> onResolved(location)，自动继续。
//  - 拒绝/失败/超时 -> 显示 CitySearch 让用户手动搜一个城市兜底。
//
// 位置不写 users 表（前端状态）。onResolved 后由父级把它存进前端 location 状态，
// 并 refreshCityEvents(loc) 拉该城市演出。

'use client';
import { useState, useEffect } from 'react';
import { CitySearch } from '@/components/CitySearch';
import type { ActiveLocation } from '@/lib/geo/types';

interface Props {
  onResolved: (loc: ActiveLocation) => void;
}

type Phase = 'locating' | 'fallback';

export function OnboardingLocation({ onResolved }: Props) {
  const [phase, setPhase] = useState<Phase>('locating');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPhase('fallback');
      return;
    }

    let done = false;
    const timer = setTimeout(() => {
      if (!done) setPhase('fallback'); // 超时也转兜底
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        done = true;
        clearTimeout(timer);
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(
            `/api/reverse-geocode?lat=${latitude}&lng=${longitude}`
          );
          const loc: ActiveLocation = await r.json();
          onResolved(loc);
        } catch {
          // 反查失败也能用坐标继续
          onResolved({
            display_name: 'My location',
            lat: latitude,
            lng: longitude,
            radius_km: 40,
          });
        }
      },
      () => {
        done = true;
        clearTimeout(timer);
        setPhase('fallback'); // 用户拒绝 -> 手动搜索兜底
      },
      { timeout: 8000, maximumAge: 60000 }
    );

    return () => clearTimeout(timer);
  }, [onResolved]);

  if (phase === 'locating') {
    return (
      <div>
        <p style={{ color: '#fff' }}>Finding shows near you…</p>
        <p style={{ color: '#888', fontSize: 13 }}>
          Allow location access in your browser to continue
        </p>
      </div>
    );
  }

  // fallback：手动搜城市
  return (
    <div>
      <p style={{ color: '#fff' }}>Couldn&apos;t get your location. Pick a city instead.</p>
      <div style={{ marginTop: 12, width: 280 }}>
        <CitySearch autoFocus onPick={onResolved} placeholder="Search a city…" />
      </div>
    </div>
  );
}
