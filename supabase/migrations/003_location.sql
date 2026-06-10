-- 003_location.sql
-- Resonate location 改造：events 加坐标 + 建 cities 表（预设城市 + geocoding 缓存）
-- 幂等：可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置：确认 002 已跑（posts.title 已补、post_comments 已存在）。

-- 1) events 加坐标列（保留 city 文本用于显示）
alter table public.events
  add column if not exists city text,
  add column if not exists lat  double precision,
  add column if not exists lng  double precision;

-- 注意：users 表【不】加当前城市字段。
-- 位置在本设计里是"前端视图状态"（用户随时切城市逛），不是账户固定属性，故不落库。

-- 2) cities 表：预设城市 + geocoding/坐标缓存
--    query_key = 归一化键（lower+trim 的城市名 或 google place_id），用于缓存命中
create table if not exists public.cities (
  id           uuid primary key default gen_random_uuid(),
  query_key    text unique not null,
  display_name text not null,
  lat          double precision not null,
  lng          double precision not null,
  radius_km    integer not null default 40,
  is_preset    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 3) events 坐标索引
create index if not exists idx_events_lat_lng on public.events (lat, lng);

-- 4) cities RLS：所有人可读；写入只走 service role
alter table public.cities enable row level security;
drop policy if exists "cities_read_all" on public.cities;
create policy "cities_read_all"
  on public.cities for select
  using (true);

-- 5) seed 预设城市：Los Angeles
insert into public.cities (query_key, display_name, lat, lng, radius_km, is_preset)
values ('los angeles', 'Los Angeles', 34.0522, -118.2437, 40, true)
on conflict (query_key) do nothing;
