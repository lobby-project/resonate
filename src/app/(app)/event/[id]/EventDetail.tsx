"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleGoingDetail } from "./actions";

const GLOWS: Record<string, string> = {
  "Electronic / EDM": "rgba(57,255,20,.5)",
  "Hip-Hop / Rap": "rgba(150,80,255,.5)",
  "Pop": "rgba(255,80,180,.5)",
  "Rock": "rgba(255,180,40,.5)",
  "R&B / Soul": "rgba(40,220,220,.5)",
  "Jazz / Blues": "rgba(60,140,255,.5)",
  "Indie / Alternative": "rgba(120,200,120,.5)",
  "Metal / Punk": "rgba(255,60,60,.5)",
  "Country / Folk": "rgba(200,160,90,.5)",
  "Latin": "rgba(255,120,40,.5)",
  "Reggae": "rgba(80,220,120,.5)",
  "Classical / Orchestra": "rgba(180,160,255,.5)",
};

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export type DetailEvent = {
  id: string;
  artist: string;
  venue: string | null;
  event_date: string | null;
  event_time: string | null;
  price_min: number | null;
  price_max: number | null;
  genre: string | null;
  cover_url: string | null;
  description: string | null;
  ticket_url: string | null;
  going_count: number;
  is_going: boolean;
  match: number;
};

function prettyDate(dateStr: string | null): string {
  if (!dateStr) return "DATE TBA";
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

export default function EventDetail({ event }: { event: DetailEvent }) {
  const router = useRouter();
  const [going, setGoing] = useState(event.is_going);
  const [count, setCount] = useState(event.going_count);
  const [busy, setBusy] = useState(false);
  const glow = GLOWS[event.genre ?? ""] ?? "rgba(57,255,20,.5)";

  async function onToggle() {
    setBusy(true);
    const next = !going;
    setGoing(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await toggleGoingDetail(event.id);
    } catch {
      setGoing(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  const priceLabel =
    event.price_min != null
      ? event.price_max && event.price_max !== event.price_min
        ? `$${Math.round(event.price_min)} – $${Math.round(event.price_max)}`
        : `$${Math.round(event.price_min)}`
      : "SEE TICKETS";

  return (
    <div className="screen" style={{ position: "relative", paddingBottom: 120 }}>
      <div className="backbar">
        <button className="back-btn" onClick={() => router.back()}>←</button>
        <span>EVENT</span>
      </div>

      {/* cover */}
      <div className="detail-cover dotgrid">
        {event.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_url}
            alt={event.artist}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
          />
        ) : (
          <>
            <div className="cv-glow" style={{ background: `radial-gradient(circle at 50% 35%, ${glow}, transparent 70%)` }} />
            <span className="cv-letter">{event.artist[0]}</span>
          </>
        )}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="detail-title">{event.artist}</div>
          <div className="detail-when">{prettyDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ""}</div>
        </div>
      </div>

      {/* match */}
      <div style={{ textAlign: "center", margin: "20px 0 6px" }}>
        <div className="label" style={{ marginBottom: 8 }}>YOUR MATCH</div>
        <div className="match-huge">{pad(event.match)}%</div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "var(--gray)", marginTop: 6 }}>
          {event.genre?.toUpperCase() ?? ""}
        </div>
      </div>

      <hr className="dashed" />

      {/* stats */}
      <div className="line-pair">
        <span className="label">GOING</span>
        <span className="dot green" style={{ fontSize: 18 }}>{pad(count)}</span>
      </div>
      <div className="line-pair">
        <span className="label">VENUE</span>
        <span className="mono" style={{ fontSize: 12, color: "#fff" }}>{event.venue ?? "TBA"}</span>
      </div>
      <div className="line-pair">
        <span className="label">PRICE</span>
        <span className="mono" style={{ fontSize: 12, color: "#fff" }}>{priceLabel}</span>
      </div>

      {event.description && (
        <>
          <hr className="dashed" />
          <div className="label" style={{ marginBottom: 10 }}>ABOUT</div>
          <p className="about-text">{event.description}</p>
        </>
      )}

      <hr className="dashed" />

      {/* event chat entry — only if going */}
      {going && (
        <button
          className="btn-link"
          style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 0 16px" }}
          onClick={() => router.push(`/chat/event/${event.id}`)}
        >
          ▸ ENTER EVENT CHAT (ANONYMOUS) →
        </button>
      )}

      {/* external ticket */}
      {event.ticket_url && (
        <a className="btn-out" href={event.ticket_url} target="_blank" rel="noopener noreferrer">
          GET TICKETS ↗
        </a>
      )}

      {/* sticky going */}
      <div className="sticky-going">
        <button className={"btn-going" + (going ? " on" : "")} disabled={busy} onClick={onToggle}>
          {going ? "✓ GOING" : "I'M GOING"}
        </button>
      </div>
    </div>
  );
}
