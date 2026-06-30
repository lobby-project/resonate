-- 010_analytics_funnel.sql
-- 管理台 Analytics 用的漏斗聚合 RPC(无 limit 的 Postgres 聚合)。
-- p_event_id = null → 全局漏斗;传 events.id → 单活动漏斗(第二期前端只用全局)。
-- 每层算 distinct 用户数(人数);going 用 analytics_events(append-only 累计),不用 event_attendees(开关态)。
-- 只给后台 service-role 调用;anon/authenticated 无执行权。
-- 幂等:可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置:008(analytics_events)已建。

create or replace function public.analytics_funnel(p_event_id uuid default null)
returns table (
  -- 购票漏斗(distinct 用户):detail_view -> going -> checkout_start -> paid
  detail_view_users bigint,
  going_users       bigint,   -- 两条漏斗共用的锚点
  checkout_users    bigint,
  paid_users        bigint,
  -- 社交漏斗(distinct 用户):going -> 发消息 -> swipe -> match
  message_users     bigint,
  swipe_users       bigint,
  match_users       bigint,
  -- swipe 方向拆分(原始去重组合数,非人数)
  swipe_resonate    bigint,
  swipe_pass        bigint
)
language sql
stable
as $$
  select
    (select count(distinct user_id) from public.analytics_events
       where event_type = 'detail_view'    and (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(distinct user_id) from public.analytics_events
       where event_type = 'going'           and (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(distinct user_id) from public.analytics_events
       where event_type = 'checkout_start'  and (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(distinct user_id) from public.orders
       where status = 'paid'                and (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(distinct user_id) from public.event_messages
       where (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(distinct swiper_id) from public.swipes
       where (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(distinct u) from (
       select user_a as u from public.matches where (p_event_id is null or event_id = p_event_id)
       union
       select user_b      from public.matches where (p_event_id is null or event_id = p_event_id)
     ) m)::bigint,
    (select count(*) from public.swipes
       where direction = 'resonate' and (p_event_id is null or event_id = p_event_id))::bigint,
    (select count(*) from public.swipes
       where direction = 'pass'     and (p_event_id is null or event_id = p_event_id))::bigint
$$;

revoke execute on function public.analytics_funnel(uuid) from public;
grant  execute on function public.analytics_funnel(uuid) to service_role;
