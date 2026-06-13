# Resonate 性能优化 Plan

> 起因:首次访问 `/events` 和 `/events/[id]` 渲染时间偏长。本文记录定位、修复、实测、后续 roadmap。
>
> 作者:Chris + Claude · 创建于 2026-06-12 · 最近更新 2026-06-12

---

## 1. 背景与基线

当前项目状态(参见最近 commit):
- Next.js 16.2.7 App Router,Supabase(Postgres + Auth + RLS)
- `events` 287 行未来演出 / `event_attendees` 5 行(beta 早期)
- Dev server:`localhost:3000`,proxy.ts(`updateSession`)做全局 auth 守卫
- `RSelectedShelf` 在 `/events` 顶部以 server component 渲染,内部又查一次 `events`

---

## 2. 定位到的瓶颈

| # | 位置 | 问题 | 性质 |
|---|------|------|------|
| **B1** | `proxy.ts` + `events/page.tsx` + `events/[id]/page.tsx` | `auth.getUser()` **每个请求 2 次网络往返**(proxy 一次 + page 又一次) | 每次 ~150–400ms |
| **B2** | `events/page.tsx`(旧) | `event_attendees` **全表 SELECT**(无 filter)| O(全表),随 going 行数线性 |
| **B3** | `events/page.tsx` 渲染 `<RSelectedShelf/>` | 无 Suspense → server child **阻塞主 feed flush**,内部再查一次 `events` | 关键路径 +100-300ms |
| **B4** | `events/[id]/page.tsx`(旧) | 5 个 await **完全串行**(其中 4 个互相独立) | 浪费 150-300ms |
| **B5** | `events/[id]/page.tsx` + 两个 actions | `count: 'exact'` 在 Postgres 上是 seq scan | 行数大了越来越慢 |
| **B6** | `events/page.tsx` → `EventsFeed` | SSR payload 含 500 行 × 13 列,client 端 `Object.fromEntries` 全表建索引 | mobile TTI 拖慢 |
| **B7** | dev 模式 | Next 16 dev 按需编译,**首次进任意页面 2-5s 是正常的** | prod build 无此问题 |

---

## 3. PR Roadmap(按 ROI 排序)

### ✅ PR #1 — DONE(本次提交)

**目标:零风险一次性吃下 B1 + B2 部分 + B4**,纯查询并行化 + auth 优化,无视觉变化、无 DB 改动、无依赖新增。

**改动文件**
- `src/app/(app)/events/page.tsx`
- `src/app/(app)/events/[id]/page.tsx`

**三处优化**

1. **P0-a:`/events/[id]` 4 个独立查询并行**
   ```ts
   const [eventRes, goingCountRes, mineRes, musicRes] = await Promise.all([
     supabase.from("events").select(...).eq("id", id).single(),
     supabase.from("event_attendees").select("*", { count: "exact", head: true }).eq("event_id", id),
     user ? supabase.from("event_attendees").select(...).eq(...).maybeSingle() : null,
     user ? supabase.from("user_music_data").select(...).maybeSingle() : null,
   ]);
   ```

2. **P0-b:`/events` 干掉 event_attendees 全表 SELECT**
   - events 查询完拿到 `eventIds`
   - 再用 `Promise.all` 并行跑两个 scoped 查询:`counts (in eventIds)` + `mine (user_id + in eventIds)`

3. **P0-c:页面级 `getUser()` 改 `getSession()`**
   ```ts
   // 旧:每次 page 渲染都打一次 GoTrue /auth/v1/user
   const { data: { user } } = await supabase.auth.getUser();
   // 新:proxy.ts 已 getUser 校验并刷过 cookie,这里只需读 cookie
   const { data: { session } } = await supabase.auth.getSession();
   const user = session?.user ?? null;
   ```
   `getSession()` 是本地 cookie 读取,无网络。安全性由 proxy.ts(更新 session 中间件)的 `getUser` 保证。

#### 实测结果

测试条件:dev server 3000、20 次 A/B 交替运行、预热后取样,SSR 客户端镜像真实 page 流程。

| 路径 | OLD p50 | NEW p50 | Δ | 提升 |
|------|--------|--------|---|------|
| `/events` | 652 ms | **126 ms** | **−527 ms** | **−81%** |
| `/events/[id]` | 261 ms | **133 ms** | **−128 ms** | **−49%** |

⚠️ **Bench 偏保守**:
1. anon 客户端无 cookie → `getUser()` 短路 0ms,实际生产 OLD 还要再加 ~150-400ms
2. RLS 把 anon events 查询挡到 0 行,生产带 287 行真实数据,串行化代价会更大
3. attendees 才 5 行,看不到 RLS-per-row 评估成本;beta 涨到 500+ 行后 OLD 进一步劣化,NEW 保持平稳

**Δ 拆分(估计)**
- `/events` 的 −527ms:~300ms ← auth 改造,~200ms ← attendees 并行+scoped
- `/events/[id]` 的 −128ms:~80ms ← auth 改造,~50ms ← 4 串行 → 4 并行

---

### 🟡 PR #2 — RSelectedShelf 用 Suspense 包裹

**目标**:让 events 主列表先到屏幕,R◉SELECTED 货架延迟流式 SSR,不阻塞父级 flush。

```tsx
// src/app/(app)/events/page.tsx
import { Suspense } from "react";

return <EventsFeed events={feed} shelf={
  <Suspense fallback={<div style={{ height: 120 }} />}>
    <RSelectedShelf />
  </Suspense>
} />;
```

**预期收益**:首字节(events 列表)提前 ~100-300ms,货架晚到无感(用占位高度避免布局抖动)。

**风险**:fallback 高度需对齐货架真实高度,否则用户会看到内容下推。建议先量 `rshelf` 的实际渲染高度再填。

---

### 🟡 PR #3 — `going_count` 触发器维护列

**目标**:消除所有 `count: 'exact', head: true` 查询。

**改动**
1. 新 migration `006_going_count_trigger.sql`:
   ```sql
   alter table public.events add column if not exists going_count int not null default 0;

   create or replace function bump_going_count() returns trigger as $$
   begin
     if tg_op = 'INSERT' then
       update public.events set going_count = going_count + 1 where id = new.event_id;
     elsif tg_op = 'DELETE' then
       update public.events set going_count = greatest(0, going_count - 1) where id = old.event_id;
     end if;
     return null;
   end; $$ language plpgsql;

   create trigger trg_bump_going
     after insert or delete on public.event_attendees
     for each row execute function bump_going_count();

   -- 回填一次
   update public.events e
   set going_count = coalesce((
     select count(*) from public.event_attendees a where a.event_id = e.id
   ), 0);
   ```

2. 代码改动:
   - `events/page.tsx`:`events.select` 加 `going_count` 列,可以**完全干掉**当前的 attendees scoped 查询(只留 mine)
   - `events/[id]/page.tsx`:`event_attendees count head` 改成 `events.select("going_count")` 直接读
   - `events/actions.ts` + `events/[id]/actions.ts` 的 `toggleGoing` anon_num 计算改用 `events.going_count + 1`

**预期收益**:`/events` 再省 1 个 DB 查询;`/events/[id]` count 查询从 ~50-200ms 变成 0(已 join 在 events 行里)。`toggleGoing` 也快。

**风险**:trigger 必须可靠。建议 migration 后手动 `update ... going_count = (subquery)` 对账一次。

---

### 🟢 PR #4 — EventsFeed payload 瘦身 + 视口分页

**目标**:减小 SSR HTML 体积、降低 client hydration cost。

**改动**
- 暂时去掉 SSR 传给 client 的不必要字段:`is_owned`(渲染用不到,只 R 徽章用一次 ev_artist 行,可以保留)、`city`(已废)
- `limit(500)` → `limit(100)`,再加 infinite scroll(IntersectionObserver)
- 把首屏 day-group 之外的 row 加 CSS `content-visibility: auto`,浏览器跳过 off-screen layout

**预期收益**:HTML 体积减半,mobile TTI 改善;真正打开 100 行外的事件需要 scroll。

**风险**:LocationContext 的距离过滤依赖 lat/lng,必须保留。infinite scroll 要兼容 genre chip 过滤(切 chip 重置滚动)。

---

### 🟢 PR #5 — actions 里的 anon_num 优化

**目标**:`toggleGoing` 不再用 `count: 'exact'` 算 anon_num。

**选项**
- 简单:`anon_num` 直接用 `going_count + 1`(配合 PR #3 的 trigger)
- 更严谨:`event_attendees.anon_num` 改用 `serial` 或 `nextval('seq_for_event_'||event_id)` 风格

---

## 4. Dev vs Prod 差距说明

⚠️ **不要在 dev 上测 perf**。Dev 慢主要来自三块:
1. **Next 16 按需编译**:第一次进 `/events` 编译 page + EventsFeed + LocationProvider + LocationPicker + BottomNav + RSelectedShelf + 各种 ticketing 依赖,2-5s 是正常的
2. **React 严格模式 / 开发警告**:渲染额外开销
3. **HMR 监听**:每个请求都有额外开销

正确的 perf 验证流程:
```bash
npm run build
npm run start
# 浏览器开 F12 Network → Disable Cache → 看 /events SSR 文档的 TTFB
```

---

## 5. 后续监控建议

合 prod 后建议加:
1. **Vercel Speed Insights** 或 `Server-Timing` header 自打点(在 page.tsx 顶部 `performance.now()`,bottom 输出到 `next/headers`)
2. **Supabase Logs**:看 slow query log,关注 `event_attendees`、`events` 查询的 p95
3. **告警阈值**:`/events` TTFB p95 > 600ms 时告警(基于 PR #1 后的基线)

---

## 6. 决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-06-12 | PR #1 改 `getSession()` 而不是给 page 注入 user header | proxy.ts 已 getUser 校验过 cookie,信任 cookie 是安全的;且 header 注入需要改 middleware,改动面大 |
| 2026-06-12 | PR #1 暂不做 `going_count` trigger | DB 改动需要单独 migration 评估,先把无风险的代码层并行化吃掉 |
| 2026-06-12 | RSelectedShelf 包 Suspense 推到 PR #2 | fallback 高度需要先量,避免布局抖动,不放在 PR #1 一锅烩 |

---

## 7. 验证 PR #1 是否还存

快速 sanity:
```bash
# 看 page.tsx 是否还是 getUser
grep -n "getUser\|getSession" src/app/\(app\)/events/page.tsx src/app/\(app\)/events/\[id\]/page.tsx
# 应该只看到 getSession (proxy.ts 那边 getUser 是正常的)
```

复跑 bench(临时):重建 `src/app/api/dbg-bench/route.ts`(本次提交里已删,但代码片段保留在 git 历史 + 本文档第 3 节)。
