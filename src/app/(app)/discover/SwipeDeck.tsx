"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCandidates, swipe, type Candidate, type SwipeResult } from "./actions";

const GLOWS = [
  "rgba(57,255,20,.5)", "rgba(150,80,255,.5)", "rgba(60,140,255,.5)",
  "rgba(40,220,220,.5)", "rgba(255,180,40,.5)", "rgba(255,60,60,.5)",
];
const glowFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GLOWS[h % GLOWS.length];
};

// The per-event swipe deck (card stack + action row + match modal).
// Extracted verbatim from PeopleMode so DISCOVER and the event People tab
// share the exact same swiping UI/logic; candidates + mutual-match detection
// stay in the getCandidates/swipe server actions (unchanged).
export default function SwipeDeck({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [stamp, setStamp] = useState<"like" | "nope" | null>(null);
  const [match, setMatch] = useState<{ matchId: string; name: string; photo: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCards = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const c = await getCandidates(id);
      setCards(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards(eventId);
  }, [eventId, loadCards]);

  const top = cards[0];

  async function act(direction: "resonate" | "pass") {
    if (!top || busy) return;
    setBusy(true);
    setStamp(direction === "resonate" ? "like" : "nope");
    const target = top;
    // pop the card after a short stamp animation
    setTimeout(() => setStamp(null), 280);
    try {
      const res: SwipeResult = await swipe(target.id, eventId, direction);
      setCards((prev) => prev.filter((c) => c.id !== target.id));
      if (res.matched) {
        setMatch({ matchId: res.matchId, name: res.otherName, photo: res.otherPhoto });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
    </>
  );
}
