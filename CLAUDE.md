# CLAUDE.md — Resonate 项目规则

> Resonate = music-anchored 1对1 social app for LA's live music scene.
> 写任何代码前先读这份文件。有疑问先问,不要乱猜。

---

## 一、产品一句话

Social-primary, music-anchored 1对1 matching app。核心闭环:
**发现演出 → 标 going → swipe 同场的人 → 双向 resonate → match → 私聊**。
LA only (V1) · Web-first (mobile responsive, 440px frame) · Beta 目标 50 人。

---

## 二、技术栈 (LOCKED)

- **Next.js 16** (App Router) + TypeScript
- **Tailwind v4** (布局/间距) + 手写 `src/app/globals.css` design system (视觉/特效)
- **shadcn/ui** (基础, 但主要用 globals.css 手写 class)
- **Supabase** (Postgres + Auth + Realtime + Storage)
- **Vercel** (部署) · **framer-motion** (已装)
- 数据源: **Spotify Web API** + **Ticketmaster Discovery API** (V1 单源)

### Next 16 关键约定
- 根级中间件叫 `src/proxy.ts` (函数 `proxy()`),不是 middleware.ts
- proxy.ts 的 matcher 已排除 /api
- src/lib/supabase/middleware.ts 是辅助文件(updateSession),名字保留不变

---

## 三、CSS 策略 (选项 C)

1. 手写 globals.css = design system 主体(Nothing dot-matrix、特效、组件 class)。视觉值从 prototype 精确移植,不要随意改。
2. Tailwind 只用于布局/间距/响应式。
不要把 dot-matrix/特效翻译成 Tailwind。优先复用 globals.css 已有 class。

### Design tokens
--bg:#000 --green:#39FF14 --green-dim:#1f7a0e --white:#fff --gray:#888 --gray3:#555 --border:#262626 --panel:#0a0a0a
字体: --ndot(Archivo Black) --dot(Pixelify Sans) --mono(JetBrains Mono)。Tailwind v4 @theme inline 已映射 7 色。

### 已有关键 class (复用别重造)
app-frame statusbar screen screen.convo screen.noscroll · bottomnav nav-item nav-plus · brand dot mono caps green label label-green dashed dotgrid empty · btn-primary btn-spotify btn-out btn-going btn-fill btn-link backbar chip chiprow · app-head day-label ev-row ev-cover ev-body going-btn · detail-cover detail-title match-huge about-text line-pair sticky-going · disc-head seg people-wrap sidebar side-thumb swipe-col swipe-deck swipe-card card-photo card-info ci-name action-row circ-btn stamp deck-empty · overlay match-panel mp-burst mp-title mp-avatars mp-av mp-spark mp-going · subtabs subtab chat-row chat-ava convo-head msg-area sys-line msg bubble input-bar send-btn · ob-screen ob-progress ob-title ob-sub genre-grid genre-chip sig-name ld-word

---

## 四、当前文件结构 (已实现)

src/
  proxy.ts                          根级中间件 (路由保护; 已排除 /api)
  app/
    globals.css                     design system (勿乱改视觉)
    layout.tsx                      引 3 字体 (next/font)
    page.tsx                        首页 (Next 默认, 待替换)
    login/page.tsx                  登录 (Spotify OAuth)
    auth/callback/route.ts          OAuth 回调 (换 session + 生成 signal + 路由)
    onboarding/page.tsx + actions.ts   4 步 (signal/photos/info/genres) → 标 onboarded
    api/sync-events/route.ts        TM sync (service role, ?secret=SYNC_SECRET)
    (app)/                          路由组, 括号不影响 URL; 共享 shell
      layout.tsx                    shell (frame + statusbar + BottomNav)
      events/page.tsx + EventsFeed.tsx + actions.ts   feed (genre 筛选/going)
      event/[id]/page.tsx + EventDetail.tsx + actions.ts  detail (真实 match%)
      discover/page.tsx + PeopleMode.tsx + actions.ts  People swipe (event stack + 卡 + match modal; getCandidates + swipe 含 service-role match 检测)
      chat/page.tsx + ChatList.tsx + actions.ts        列表 (Event Rooms / Private)
      chat/event/[id]/(page.tsx + EventChat.tsx)       匿名群聊 Realtime (Listener #N)
      chat/private/[matchId]/(page.tsx + PrivateChat.tsx)  实名 1对1 Realtime
  lib/
    supabase/(client.ts server.ts middleware.ts)
    spotify.ts                      只用确认可用端点
    music-signal.ts                 规则引擎 (非 LLM, 覆盖 12 类)
    ticketmaster.ts                 client + genre ID 精确映射
  components/shared/BottomNav.tsx

还没建 (会 404, 预期): /discover Content 发帖、/profile、/post/new。

---

## 五、12 Genre 大类 (LOCKED)

Electronic/EDM · Hip-Hop/Rap · Pop · Rock · R&B/Soul · Jazz/Blues · Indie/Alternative · Metal/Punk · Country/Folk · Latin · Reggae · Classical/Orchestra

⚠️ 大小写不一致 (待办): events 表存 Title Case ("Rock"),onboarding 存 UPPER ("ROCK")。按 genre 过滤要 case-insensitive。event detail 的 match% 已做 case-insensitive。

---

## 六、数据库 (已建 11 表 + RLS + Storage + trigger)

关键 RLS:
- swipes 只能读自己的 (swiper_id = auth.uid()) — 保护隐私 → match 检测必须用 service role 在 server action 做
- 私信只有 match 双方可读 (in_match); event chat 只有 going 的人可读 (is_attending)
- matches: user_a < user_b 规范化
- users.id = auth.users.id; 注册 trigger 自动建 public.users 行

Realtime: event_messages + private_messages 已加入 supabase_realtime publication。

---

## 七、核心产品规则

- 匿名: event chat 匿名 (Listener #N); 其他实名
- People mode: 严格同场 going 才能 swipe; 无 going → empty
- Match: 双向 resonate → matches → 私聊
- Post (未实现): 必须 tag event 或 artist (二选一)
- Ticket: 外链 TM, 无 in-app 购票
- Music Signal: 规则生成, onboarding 一次, V1 不可改
- 无 group/posse (V1)

---

## 八、代码风格

- Server Components 默认; 需交互才 'use client'
- Mutations 用 Server Actions (除 OAuth 回调 + sync)
- 实时用 Supabase Realtime
- 命名: kebab-case 文件, PascalCase 组件
- 图片用普通 <img> (带 eslint-disable),不用 next/image
- service_role key 只在服务端, 绝不进前端; .env.local 绝不进 git

### .env.local 必需变量
NEXT_PUBLIC_SUPABASE_URL (纯根 URL, 到 .supabase.co, 不带 /rest/v1)
NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI / TICKETMASTER_API_KEY / SYNC_SECRET / NEXT_PUBLIC_SITE_URL
⚠️ 改 .env.local 后必须重启 dev server (Next 不热加载)。

---

## 九、外部 API

- Spotify: 只用 /me/top/artists, /me/top/tracks, /me。⚠️ dev mode 5 用户上限, 每个测试者加 allowlist。
- Ticketmaster: apikey query param。genre 用 Genre ID 精确映射 (24→12) + World subGenre 细分 + 兜底日志。

---

## 十、协作方式

- 创始人 = Chris (GitHub org lobby-project, repo lobby-project/resonate 小写)
- Claude (chat): 规划/写文件/debug/文档。Claude Code (你, 本地): 放文件/跑命令/git/验证, 优先信本地真实状态。
- 流程: Claude 写文件 → Chris 下载 → 你放到路径 → 你执行验证
- 操作前先说要跑什么命令 (尤其 git/删除/改配置)
- ⚠️ 务必在项目目录操作 (cd ~/resonate), 不要在家目录跑 git (出过事故)
- 放文件字节级精确, 不要"优化"或改逻辑/视觉值

---

## 十一、待办 / 战略

- Spotify 5 人墙: dev mode 5 用户, beta 50 人会撞。方向 B+ (playlist 展示型名片, 不调 API)。beta 前决策。
- genre 大小写对齐
- 未建: Discover Content 发帖、Profile + Settings、首页替换
- Vercel Cron 定时 sync (现手动)

---

写代码前: 读相关 globals.css class + 确认文件结构 + 字节级精确。有疑问先问 Chris。
