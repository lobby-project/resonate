"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getCandidates,
  swipe,
  type Candidate,
  type GoingEvent,
  type SwipeResult,
} from "./actions";
import ContentFeed, { type FeedPost } from "./ContentFeed";

const GLOWS = [
  "rgba(57,255,20,.5)", "rgba(150,80,255,.5)", "rgba(60,140,255,.5)",
  "rgba(40,220,220,.5)", "rgba(255,180,40,.5)", "rgba(255,60,60,.5)",
];
const glowFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GLOWS[h % GLOWS.length];
};
const pad3 = (n: number) => String(n).padStart(3, "0");

export default function PeopleMode({ events, posts = [] }: { events: GoingEvent[]; posts?: FeedPost[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"people" | "content">("content");
  const [activeEvent, setActiveEvent] = useState<string | null>(events[0]?.id ?? null);
  const [cards, setCards] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [stamp, setStamp] = useState<"like" | "nope" | null>(null);
  const [match, setMatch] = useState<{ matchId: string; name: string; photo: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCards = useCallback(async (eventId: string) => {
    setLoading(true);
    try {
      const c = await getCandidates(eventId);
      setCards(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeEvent) loadCards(activeEvent);
  }, [activeEvent, loadCards]);

  const top = cards[0];

  async function act(direction: "resonate" | "pass") {
    if (!top || !activeEvent || busy) return;
    setBusy(true);
    setStamp(direction === "resonate" ? "like" : "nope");
    const target = top;
    // pop the card after a short stamp animation
    setTimeout(() => setStamp(null), 280);
    try {
      const res: SwipeResult = await swipe(target.id, activeEvent, direction);
      setCards((prev) => prev.filter((c) => c.id !== target.id));
      if (res.matched) {
        setMatch({ matchId: res.matchId, name: res.otherName, photo: res.otherPhoto });
      }
    } finally {
      setBusy(false);
    }
  }

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

          {/* swipe column */}
          <div className="swipe-col">
            <div className="swipe-deck">
              {loading ? (
                <div className="deck-empty">
                  <span className="dot" style={{ fontSize: 16, color: "var(--gray)" }}>LOADING...</span>
                </div>
              ) : !top ? (
                <div className="deck-empty">
                  <span className="dot" style={{ fontSize: 18, color: "var(--gray)" }}>NO ONE LEFT</span>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "var(--gray3)" }}>
                    CHECK BACK · MORE PEOPLE MARK THIS SHOW DAILY ●
                  </span>
                </div>
              ) : (
                <div className="swipe-card">
                  <div className="card-photo dotgrid">
                    {top.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={top.photo} alt={top.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <>
                        <div className="cp-glow" style={{ background: `radial-gradient(circle at 50% 40%, ${glowFor(top.name)}, transparent 70%)` }} />
                        <span className="cp-label">NO PHOTO</span>
                      </>
                    )}
                    {stamp && <div className={"stamp " + stamp}>{stamp === "like" ? "RESONATE" : "PASS"}</div>}
                  </div>
                  <div className="card-info">
                    <div className="ci-name">{top.name}{top.age ? <span> / {top.age}</span> : null}</div>
                    {top.signal && <div className="ci-role">{top.signal.toUpperCase()}</div>}
                    <div className="ci-going">● GOING TO THIS SHOW</div>
                  </div>
                </div>
              )}
            </div>

            {/* action buttons */}
            {top && !loading && (
              <div className="action-row">
                <button className="circ-btn pass" onClick={() => act("pass")} disabled={busy} aria-label="Pass">✕</button>
                <button className="circ-btn like" onClick={() => act("resonate")} disabled={busy} aria-label="Resonate">♥</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* match modal */}
      {match && (
        <div className="overlay" onClick={() => setMatch(null)}>
          <div className="match-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mp-burst" />
            <div className="mp-title">IT&apos;S A MATCH</div>
            <div className="mp-sub">YOU BOTH RESONATED</div>
            <div className="mp-avatars">
              <div className="mp-av av-l dotgrid">
                <div className="cv-glow" style={{ background: "radial-gradient(circle, rgba(57,255,20,.5), transparent 70%)" }} />
                <span style={{ position: "relative", zIndex: 2 }}>♪</span>
              </div>
              <div className="mp-av av-r dotgrid">
                {match.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={match.photo} alt={match.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ position: "relative", zIndex: 2 }}>{match.name[0]}</span>
                )}
                <div className="mp-spark" />
              </div>
            </div>
            <div className="mp-going">WITH {match.name.toUpperCase()}</div>
            <button className="btn-fill" onClick={() => router.push(`/chat/private/${match.matchId}`)}>
              SEND A MESSAGE →
            </button>
            <button className="btn-link" onClick={() => setMatch(null)}>KEEP SWIPING</button>
          </div>
        </div>
      )}
    </div>
  );
}
