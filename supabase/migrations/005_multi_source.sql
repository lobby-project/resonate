-- 005_multi_source.sql
-- 多 API 聚合改造：events 加多源记录 + 场馆坐标缓存表
-- 幂等：可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置：003、004 已跑。

-- 1) events 加 sources 字段：记录这场演出在哪些源出现过、各自的购票链接/价格
--    结构示例：
--    [{"source":"ticketmaster","url":"https://...","price_min":50},
--     {"source":"gametime","url":"https://...","price_min":65}]
alter table public.events
  add column if not exists sources jsonb not null default '[]'::jsonb;

-- 说明：events.tm_id 继续作为唯一键。
--   TM 来的演出：tm_id = Ticketmaster 真实 id
--   SerpApi 来的、TM 没有的演出：tm_id = 'serp:' + 稳定哈希（代码生成，跨同步稳定）
--   这样现有 upsert(onConflict tm_id) 逻辑完全不用动。

-- 2) 场馆坐标缓存：SerpApi 的演出只有场馆名没坐标，
--    用 Google Geocoding 转一次后缓存，同一场馆永不重复调用。
create table if not exists public.venue_geocache (
  query_key   text primary key,        -- lower(trim(场馆名)) + '|' + lower(trim(城市))
  venue_name  text not null,
  city        text,
  lat         double precision,
  lng         double precision,        -- lat/lng 为 null = geocode 失败过，短期内不再重试
  created_at  timestamptz not null default now()
);

-- 3) RLS：场馆缓存只有服务端读写（service role 绕过 RLS），前端不需要碰
alter table public.venue_geocache enable row level security;
-- 不建任何 anon 策略 = anon 完全无权限，只有 service role 可读写。
