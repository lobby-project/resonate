// src/components/CitySearch.tsx
// 城市搜索：边打字边出候选（Google Places Autocomplete）。
// 两个地方复用：onboarding 拿不到定位时的兜底、右上角切城市。
// 选中候选 -> 调 /api/place-coords 拿坐标 -> onPick(location)。
//
// 样式：结构 + 内联关键布局（下拉容器 position/overflow）。配色用你们 tokens。
// 关键布局内联写，不依赖 globals.css（你们踩过追加不生效的坑）。

'use client';
import { useState, useEffect, useRef } from 'react';
import type { ActiveLocation } from '@/lib/geo/types';

interface Prediction {
  place_id: string;
  description: string;
}

interface Props {
  onPick: (loc: ActiveLocation) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CitySearch({ onPick, placeholder = 'Search a city…', autoFocus }: Props) {
  const [q, setQ] = useState('');
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖：停止打字 ~250ms 才查，省 API 调用
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setPreds([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/places-autocomplete?q=${encodeURIComponent(term)}`
        );
        const d = await r.json();
        setPreds(d.predictions ?? []);
      } catch {
        setPreds([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  async function choose(p: Prediction) {
    setLoading(true);
    setPreds([]);
    setQ(p.description);
    try {
      const r = await fetch(
        `/api/place-coords?place_id=${encodeURIComponent(p.place_id)}`
      );
      if (!r.ok) return;
      const loc: ActiveLocation = await r.json();
      onPick(loc);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
      {preds.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            maxHeight: 240,
            overflowY: 'auto',
            zIndex: 50,
          }}
        >
          {preds.map((p) => (
            <li
              key={p.place_id}
              onClick={() => choose(p)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                color: '#fff',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Locating…</p>
      )}
    </div>
  );
}
