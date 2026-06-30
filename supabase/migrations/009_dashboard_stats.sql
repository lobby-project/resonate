-- 009_dashboard_stats.sql
-- 管理台 Dashboard 用的跨活动聚合 RPC(无上限 SUM/COUNT,纯 Postgres,避免 limit 低估)。
-- 只给后台 service-role 调用;anon/authenticated 无执行权(不向产品端暴露营收)。
-- 幂等:可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run

create or replace function public.dashboard_stats()
returns table (
  revenue_cents  bigint,   -- 所有 paid 订单 total_cents 求和
  tickets_sold   bigint,   -- valid tickets 计数
  pending_orders bigint    -- pending 订单计数
)
language sql
stable
as $$
  select
    coalesce((select sum(total_cents) from public.orders  where status = 'paid'), 0)::bigint,
    (select count(*) from public.tickets where status = 'valid')::bigint,
    (select count(*) from public.orders  where status = 'pending')::bigint
$$;

-- 锁权限:只有 service-role 能执行(管理台用 service-role client 调)。
revoke execute on function public.dashboard_stats() from public;
grant  execute on function public.dashboard_stats() to service_role;
