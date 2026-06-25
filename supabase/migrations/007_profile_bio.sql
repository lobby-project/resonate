-- 007_profile_bio.sql
-- Resonate profile 改造：users 表新增 bio（个人简介）。
-- 幂等：可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置：006 已跑（gender / ig_handle 已存在）。

alter table public.users
  add column if not exists bio text;

-- bio：用户个人简介，自由文本，可空。长度限制在应用层做（不加 CHECK 约束，便于日后调整）。
