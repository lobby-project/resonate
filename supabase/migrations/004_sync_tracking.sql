-- 004_sync_tracking.sql
-- 时间刷新改造：cities 表加"上次同步时间"，用于按需刷新的 12 小时阈值判断。
-- 幂等：可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run

alter table public.cities
  add column if not exists last_synced_at timestamptz;

-- 说明：
-- last_synced_at 为 null = 从未同步过（首次切到该城市必刷）。
-- refresh-city-events 同步成功后会更新它。
-- Cron 每日同步预设城市后同样更新。
