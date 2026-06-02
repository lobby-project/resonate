# CLAUDE.md — Resonate 项目规则

> Resonate = music-anchored 1对1 social app for LA's live music scene
> 这份文件定义项目约定。写任何代码前先读这里。

---

## 产品一句话

Social-primary, music-anchored 1对1 matching app. 用户发现演出 → mark going →
swipe 同场 going 的人 → mutual resonate 匹配 → 1对1 chat。差异化: Spotify-native
matching (Music Signal) + 演出 anchor + 内容社区。

LA only (V1) · Web-first (mobile responsive) · Beta target 50 friends

---

## 技术栈 (LOCKED)

- **Framework**: Next.js 14+ App Router + TypeScript
- **Styling**: Tailwind CSS (布局/间距) + 手写 globals.css design system (视觉/特效)
- **UI 基础**: shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Realtime + Storage)
- **Deploy**: Vercel
- **Swipe/动画**: framer-motion
- **数据源**: Spotify Web API (music) + Ticketmaster Discovery API (events, V1 单源)

---

## CSS 策略 (重要 — 选项 C)

**两层分工, 不要混淆:**

1. **手写 CSS (src/app/globals.css)** — design system 主体
   - 所有 design tokens (CSS variables)
   - Nothing dot-matrix 风格 (NDOT 字体技巧)
   - 特效: grain, scanlines, shimmer, glow burst, swipe stamps
   - 复杂组件类 (.swipe-card, .match-panel, .ev-row, .post-card 等)
   - **这套 CSS 从设计 prototype 精确移植, 不要随意改动视觉值**

2. **Tailwind** — 只用于:
   - 布局 (flex/grid/gap)
   - 间距 (padding/margin)
   - 响应式 (sm:/md:)
   - 简单 utility

**不要**把 dot-matrix/特效那套翻译成 Tailwind — 会走样。用 globals.css 的 class。

---

## Design Tokens (与 globals.css 同步)

```
--bg:        #000000   纯黑背景
--green:     #39FF14   荧光绿 (主色: 激活态/主按钮/关键数字)
--green-dim: #1f7a0e   暗绿 (边框/次要)
--white:     #ffffff
--gray:      #888888   次要文字
--gray3:     #555555   三级文字
--border:    #262626   边框
--panel:     #0a0a0a   卡片背景
--panel2:    #111111
```

字体:
```
--ndot: 'Archivo Black'      → dot-matrix headers (用 NDOT 技巧)
--dot:  'Pixelify Sans'      → 像素装饰字
--mono: 'JetBrains Mono'     → body / metadata / labels
```

## 视觉规范

- 标题/大数字: 用 NDOT 技巧 (Archivo Black + radial-gradient 圆点 + background-clip:text)
- labels/按钮: ALL CAPS, letter-spacing 宽
- 数字: 前导零 (MATCH 087%, 008 EVENTS)
- 边框: 锐利 (border-radius 最多 6-8px)
- 分隔线: dashed
- 特效克制: grain/scanlines 是 "felt not seen"

---

## 文件结构

```
src/
  app/
    globals.css            ← design system (手写, 勿乱改视觉)
    layout.tsx             ← root layout, 引字体
    page.tsx               ← landing / 路由
    (onboarding)/          ← onboarding flow
    (app)/                 ← 主 app (4 tabs + FAB)
      layout.tsx           ← app shell + bottom nav
      events/
      discover/
      chat/
      profile/
    api/
      auth/spotify/
    auth/callback/spotify/
  components/
    shared/                ← StatusBar, BottomNav, icons
    ui/                    ← shadcn
  lib/
    supabase/              ← client.ts, server.ts, middleware.ts
    spotify.ts             ← Spotify API
    ticketmaster.ts        ← Ticketmaster API
    music-signal.ts        ← Signal 生成
  types/
    database.ts            ← Supabase generated types
supabase/
  migrations/              ← SQL migrations
```

---

## V1 架构 (4 tabs + center FAB)

底部导航: [EVENTS] [DISCOVER] [+] [CHAT] [PROFILE]

- **Tab 1 Events**: feed (location + genre bar + day-grouped) / detail / 匿名 event chat / 外链 ticket
- **Tab 2 Discover**: Content mode (双排瀑布, 真名) + People mode (左 sidebar event stack + Tinder swipe, 同场 going only)
- **Tab 3 Chat**: Event Rooms (匿名) + Private Chats (真名 1对1)
- **Tab 4 Profile**: Posts only (V1) sub-tab
- **FAB**: Create post (song/photo/video/playlist, 必须 tag event 或 artist)

---

## 关键产品规则

- **匿名规则 (hybrid)**: Event Chat 匿名 (Listener #N + Music Signal); 其他全部实名
- **People mode**: 严格同场 going event 才能 swipe; 无 going event → empty state
- **Match**: mutual resonate (双方右滑) → matches 表 → 1对1 chat
- **Post**: 必须 tag 一个 event 或 artist (二选一, 不能都不选)
- **Ticket**: 外链 Ticketmaster, 无 in-app 购票 (V1)
- **Music Signal**: 25 个, rule-based, onboarding 生成一次 (V1 不可改)
- **无 group/posse** (V1)

---

## V1 vs V1.5 (不要在 V1 实现 V1.5 的东西)

V1.5 backlog (现在别做):
- Event chat 富媒体 (V1 text only)
- AI NSFW moderation (V1 人工 review)
- Content 评论 (V1 view only)
- "Made for You" 算法 (V1 按日期)
- Profile Going/Past/Matches sub-tabs (V1 只 Posts)
- 多源 events 聚合 + 去重 (V1 只 Ticketmaster)
- Music Signal re-generate

---

## 安全 / 隐私

- 每张表必须有 RLS policy
- `.env.local` 绝不进 git (已在 .gitignore)
- service_role key 只在服务端用, 绝不进前端
- Spotify token 加密存储 + refresh 逻辑
- 私信/swipe 记录: 只有参与者可读

---

## 代码风格

- Server Components 默认; 需要交互/状态才 'use client'
- Mutations 用 Server Actions (不是 API routes), 除非 OAuth 回调
- 实时 (chat) 用 Supabase Realtime channels
- 命名: kebab-case 文件, PascalCase 组件
- 写代码前确认是否已有对应 globals.css class 可用

---

## ⚠️ 待解决战略问题 (写代码不受影响, 但记着)

1. **Spotify API 限制**: development mode ~25 用户上限; extended quota 要 25 万月活
   → 影响规模化。可能需要降低 Spotify 依赖 (用户手填 artists 作 fallback)
2. 产品定位: genre 扩到 12 全类型, 定位 "LA live music scene"
3. Music Signal 25 个需扩展覆盖全类型 (现偏 electronic)

---

**写代码前: 读相关 globals.css class + 确认 V1/V1.5 边界。有疑问先问。**
