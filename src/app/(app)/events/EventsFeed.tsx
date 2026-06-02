"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleGoing } from "./actions";

const GENRES = [
  "ALL", "ELECTRONIC / EDM", "HIP-HOP / RAP", "POP", "ROCK", "R&B / SOUL",
  "JAZZ / BLUES", "INDIE / ALTERNATIVE", "METAL / PUNK", "COUNTRY / FOLK",
  "LATIN", "REGGAE", "CLASSICAL / ORCHESTRA",
];

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

export type FeedEvent = {
  id: string;
  artist: string;
  venue: string | null;
  event_date: string | null;
  event_time: string | null;
  price_min: number | null;
  genre: string | null;
  cover_url: string | null;
  going_count: number;
  is_going: boolean;
  match: number; // 0-100 placeholder for now
};

function dayLabel(dateStr: string | null): string {
  if (!dateStr) return "UPCOMING";
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "TOMORROW";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}

export default function EventsFeed({ events }: { events: FeedEvent[] }) {
  const [genre, setGenre] = useState("ALL");
  const [goingState, setGoingState] = useState<Record<string, boolean>>(
    Object.fromEntries(events.map((e) => [e.id, e.is_going]))
  );
  const router = useRouter();

  const filtered = events.filter((e) => genre === "ALL" || e.genre === genre);

  // group by day, preserving date order
  const days: { label: string; items: FeedEvent[] }[] = [];
  for (const e of filtered) {
    const label = dayLabel(e.event_date);
    let g = days.find((d) => d.label === label);
    if (!g) { g = { label, items: [] }; days.push(g); }
    g.items.push(e);
  }

  async function onToggle(id: string) {
    setGoingState((s) => ({ ...s, [id]: !s[id] })); // optimistic
    try { await toggleGoing(id); } catch { setGoingState((s) => ({ ...s, [id]: !s[id] })); }
  }

  return (
    <div className="screen">
      <div className="app-head">
        <div className="brand">RESONATE</div>
        <div className="loc"><span className="green">◢</span> LOS ANGELES</div>
      </div>

      <div className="chiprow">
        {GENRES.map((g) => (
          <button key={g} className={"chip" + (genre === g ? " active" : "")} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      {days.length === 0 && (
        <div className="empty">
          <span className="big">NO {genre} SHOWS</span>
          TRY ANOTHER FREQUENCY ●
        </div>
      )}

      {days.map((d) => (
        <div key={d.label}>
          <div className="day-label">{d.label}</div>
          {d.items.map((ev) => {
            const going = goingState[ev.id];
            const glow = GLOWS[ev.genre ?? ""] ?? "rgba(57,255,20,.5)";
            const price = ev.price_min != null ? `$${Math.round(ev.price_min)}` : "—";
            return (
              <div key={ev.id} className="ev-row" onClick={() => router.push(`/event/${ev.id}`)}>
                <div className="ev-cover dotgrid">
                  {ev.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.cover_url}
                      alt={ev.artist}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <>
                      <div className="cv-glow" style={{ background: `radial-gradient(circle at 50% 40%, ${glow}, transparent 70%)` }} />
                      <span style={{ position: "relative", zIndex: 2 }}>{ev.artist[0]}</span>
                    </>
                  )}
                </div>
                <div className="ev-body">
                  <div className="ev-artist">{ev.artist}</div>
                  <div className="ev-meta">{[ev.venue, ev.event_time, price].filter(Boolean).join(" · ")}</div>
                  <div className="ev-stats">{pad(ev.going_count)} GOING · MATCH {pad(ev.match)}%</div>
                </div>
                <button
                  className={"going-btn" + (going ? " on" : "")}
                  onClick={(e) => { e.stopPropagation(); onToggle(ev.id); }}
                >
                  {going ? "✓ GOING" : "GOING"}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
