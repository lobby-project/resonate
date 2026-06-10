"use client";

import { usePathname } from "next/navigation";

// 双栏容器。路由决定手机端显示哪一栏:
//   /chat            → at-index:手机只显示列表
//   /chat/event/...  → at-convo:手机只显示对话(保持原跳页体验)
// 桌面(>=1024px)始终双栏并排,CSS 见 globals.css 的 CHAT TWO-PANE 区块。
export default function ChatShell({
  list,
  children,
}: {
  list: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const atIndex = pathname === "/chat";

  return (
    <div className={"chat-shell " + (atIndex ? "at-index" : "at-convo")}>
      <aside className="chat-pane-list">{list}</aside>
      <section className="chat-pane-convo">{children}</section>
    </div>
  );
}
