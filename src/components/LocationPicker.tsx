// src/components/LocationPicker.tsx
// 右上角的位置控件：显示当前城市名 + 一个搜索图标。
// 点图标 -> 展开 CitySearch -> 选中城市 -> onChange(新location)。
//
// 用在 app 主界面顶栏右上角。当前 location 由父级（或 context）持有并传入。
// 选中后父级负责：更新当前 location 状态 + refreshCityEvents(loc) + events feed 重查。

'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { CitySearch } from '@/components/CitySearch';
import type { ActiveLocation } from '@/lib/geo/types';

interface Props {
  current: ActiveLocation | null;
  onChange: (loc: ActiveLocation) => void;
}

export function LocationPicker({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {!open ? (
        <>
          <span style={{ color: '#fff', fontSize: 14 }}>
            {current?.display_name ?? 'Choose city'}
          </span>
          <button
            onClick={() => setOpen(true)}
            aria-label="Search city"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#39FF14',
            }}
          >
            <Search size={18} />
          </button>
        </>
      ) : (
        <div style={{ width: 240 }}>
          <CitySearch
            autoFocus
            placeholder="Search a city…"
            onPick={(loc) => {
              onChange(loc);
              setOpen(false);
            }}
          />
          <button
            onClick={() => setOpen(false)}
            style={{
              marginTop: 4,
              background: 'transparent',
              border: 'none',
              color: '#888',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
