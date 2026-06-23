-- 006_onboarding_profile.sql
-- Resonate onboarding 重构（4 屏）：users 表新增 gender + ig_handle。
-- 幂等：可安全重复执行。Supabase -> SQL Editor -> 粘贴全文 -> Run
-- 前置：003/004/005 已跑。

alter table public.users
  add column if not exists gender    text,
  add column if not exists ig_handle text;

-- gender 取值约定（应用层校验，不加 CHECK 约束以便日后扩展）：
--   'male' | 'female' | 'nonbinary' | 'undisclosed'
-- ig_handle：用户填写的 Instagram 句柄原文（去掉前导 @ 后存储；可空）。
