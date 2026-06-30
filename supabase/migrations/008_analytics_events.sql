-- 008_analytics_events.sql
-- Resonate 漏斗埋点:append-only 事件表。第一期只记 detail_view / going / checkout_start。
-- 幂等:可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置:无(独立表)。插桩代码在主产品 resonate;管理台共用同一 Supabase,用 service-role 读。

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,        -- 'detail_view' | 'going' | 'checkout_start'(应用层约定,不加 CHECK 便于扩展)
  event_id    uuid,                 -- 关联活动 events.id,可空(无 FK:松耦合、不阻塞删除、append-only)
  user_id     uuid,                 -- 触发用户 auth.users.id,可空
  metadata    jsonb,                -- 额外上下文,可空(如 {via:'feed'} / {qty:2, subtotal_cents:9000})
  created_at  timestamptz not null default now()
);

-- 漏斗查询索引(按 type+时间、按活动聚合)
create index if not exists idx_ae_type_created on public.analytics_events (event_type, created_at desc);
create index if not exists idx_ae_event        on public.analytics_events (event_id);

-- RLS:登录用户只能 INSERT 自己的事件(user_id 必须等于自己);
-- 不建 SELECT policy → 普通用户读不到;管理台 Dashboard 用 service-role 自动绕过 RLS 读取。
alter table public.analytics_events enable row level security;

drop policy if exists "auth insert own analytics" on public.analytics_events;
create policy "auth insert own analytics"
  on public.analytics_events for insert
  to authenticated
  with check (user_id = auth.uid());
