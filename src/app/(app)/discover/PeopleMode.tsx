"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type GoingEvent } from "./actions";
import ContentFeed, { type FeedPost } from "./ContentFeed";
import SwipeDeck from "./SwipeDeck";

const GLOWS = [
  "rgba(57,255,20,.5)", "rgba(150,80,255,.5)", "rgba(60,140,255,.5)",
  "rgba(40,220,220,.5)", "rgba(255,180,40,.5)", "rgba(255,60,60,.5)",
];
const glowFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GLOWS[h % GLOWS.length];
};

export default function PeopleMode({ events, posts = [] }: { events: GoingEvent[]; posts?: FeedPost[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"people" | "content">("content");
  const [activeEvent, setActiveEvent] = useState<string | null>(events[0]?.id ?? null);

  // ----- header + segment toggle -----
  return (
    <div className="screen noscroll" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="disc-head">
        <div className="disc-title">DISCOVER</div>
        <div className="seg">
          <button className={mode === "content" ? "active" : ""} onClick={() => setMode("content")}>CONTENT</button>
          <button className={mode === "people" ? "active" : ""} onClick={() => setMode("people")}>PEOPLE</button>
        </div>
      </div>

      {mode === "content" ? (
        <ContentFeed posts={posts} />
      ) : events.length === 0 ? (
        <div className="empty" style={{ marginTop: 40 }}>
          <span className="big">NO SHOWS YET</span>
          MARK A SHOW AS GOING IN EVENTS TO MEET PEOPLE THERE ●
          <div style={{ marginTop: 18 }}>
            <button className="btn-primary" onClick={() => router.push("/events")}>BROWSE EVENTS →</button>
          </div>
        </div>
      ) : (
        <div className="people-wrap" style={{ flex: 1, minHeight: 0 }}>
          {/* left event stack */}
          <div className="sidebar">
            {events.map((e) => (
              <button
                key={e.id}
                className={"side-thumb" + (activeEvent === e.id ? " active" : "")}
                onClick={() => setActiveEvent(e.id)}
                title={e.artist}
              >
                <div className="st-media dotgrid">
                  {(e as GoingEvent & { cover_url?: string | null }).cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(e as GoingEvent & { cover_url?: string | null }).cover_url!}
                      alt={e.artist}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <>
                      <div className="cv-glow" style={{ background: `radial-gradient(circle at 50% 40%, ${glowFor(e.artist)}, transparent 70%)` }} />
                      <span style={{ position: "relative", zIndex: 2 }}>{e.artist[0]}</span>
                    </>
                  )}
                </div>
                <span className="st-name">{e.artist}</span>
              </button>
            ))}
          </div>

          {/* swipe column — shared deck, keyed by the active event */}
          {activeEvent && <SwipeDeck eventId={activeEvent} />}
        </div>
      )}
    </div>
  );
}
