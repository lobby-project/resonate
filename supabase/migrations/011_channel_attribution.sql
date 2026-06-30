-- 011_channel_attribution.sql
-- 第三期渠道追踪:(1) orders 加 channel 列 (2) 单活动渠道效果 RPC。
-- 幂等:可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置:008(analytics_events)已建。

-- (1) orders 加渠道列(购票侧归因)
alter table public.orders add column if not exists channel text;
create index if not exists idx_orders_event_channel on public.orders (event_id, channel);

-- (2) 单活动渠道效果:按 channel 对齐
--     点击侧 = analytics_events.metadata.ref(独立访客 distinct user_id),
--     购票侧 = orders.channel where paid(订单数 + 收入)。
--     两侧 channel 名用同一套 cleanRef 清洗 → 字符串精确对齐(full outer join)。
create or replace function public.event_channel_stats(p_event_id uuid)
returns table (
  channel       text,
  clicks        bigint,        -- 独立访客数(distinct user_id)
  purchases     bigint,        -- 该渠道 paid 订单数
  revenue_cents bigint         -- 该渠道 paid 订单 total_cents 求和
)
language sql
stable
as $$
  with clicks as (
    select metadata->>'ref' as channel, count(distinct user_id) as clicks
    from public.analytics_events
    where event_type = 'detail_view'
      and event_id = p_event_id
      and nullif(metadata->>'ref', '') is not null
    group by metadata->>'ref'
  ),
  buys as (
    select channel, count(*) as purchases, coalesce(sum(total_cents), 0) as revenue_cents
    from public.orders
    where event_id = p_event_id
      and status = 'paid'
      and nullif(channel, '') is not null
    group by channel
  )
  select
    coalesce(c.channel, b.channel)        as channel,
    coalesce(c.clicks, 0)::bigint         as clicks,
    coalesce(b.purchases, 0)::bigint      as purchases,
    coalesce(b.revenue_cents, 0)::bigint  as revenue_cents
  from clicks c
  full outer join buys b on b.channel = c.channel
  order by revenue_cents desc, clicks desc
$$;

revoke execute on function public.event_channel_stats(uuid) from public;
grant  execute on function public.event_channel_stats(uuid) to service_role;
