"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { id: "events", label: "EVENTS", path: "/events" },
  { id: "discover", label: "DISCOVER", path: "/discover" },
  { id: "chat", label: "CHAT", path: "/chat" },
  { id: "profile", label: "PROFILE", path: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <div className="bottomnav">
      <div className="nav-logo">res<span className="o">◉</span>nate</div>
      <button className={"nav-item" + (isActive("/events") ? " active" : "")} onClick={() => router.push("/events")}>
        <span className="nav-ico">📅</span>
        <span>EVENTS</span>
        <span className="nav-dot" />
      </button>
      <button className={"nav-item" + (isActive("/discover") ? " active" : "")} onClick={() => router.push("/discover")}>
        <span className="nav-ico">◈</span>
        <span>DISCOVER</span>
        <span className="nav-dot" />
      </button>

      <button className="nav-plus" onClick={() => router.push("/post/new")} aria-label="Create post">
        <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
        <span className="nav-plus-label">NEW POST</span>
      </button>

      <button className={"nav-item" + (isActive("/chat") ? " active" : "")} onClick={() => router.push("/chat")}>
        <span className="nav-ico">💬</span>
        <span>CHAT</span>
        <span className="nav-dot" />
      </button>
      <button className={"nav-item" + (isActive("/profile") ? " active" : "")} onClick={() => router.push("/profile")}>
        <span className="nav-ico">◐</span>
        <span>PROFILE</span>
        <span className="nav-dot" />
      </button>
    </div>
  );
}
