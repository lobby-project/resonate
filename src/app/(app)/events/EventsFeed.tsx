"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleGoing } from "./actions";
import { LocationPicker } from "@/components/LocationPicker";
import { useLocation } from "@/lib/geo/LocationProvider";
import { refreshCityEvents } from "@/lib/geo/types";

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
  city: string | null;
  lat: number | null;
  lng: number | null;
  going_count: number;
  is_going: boolean;
  match: number; // 0-100 placeholder for now
};

// Great-circle distance in km between two lat/lng points (Haversine).
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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

export default function EventsFeed({ events, shelf }: { events: FeedEvent[]; shelf?: React.ReactNode }) {
  const [genre, setGenre] = useState("ALL");
  const [goingState, setGoingState] = useState<Record<string, boolean>>(
    Object.fromEntries(events.map((e) => [e.id, e.is_going]))
  );
  const router = useRouter();
  const { location, setLocation } = useLocation();

  // Filter by Haversine distance to the active location (≤ radius_km) +
  // genre chip. Catches neighborhoods/suburbs (Brooklyn, Hollywood, Pasadena)
  // that strict city-name match would miss. Events with null coords are
  // excluded when a location is set. genre comparison stays case-insensitive.
  const filtered = events.filter((e) => {
    if (location) {
      if (e.lat == null || e.lng == null) return false;
      if (distanceKm(e.lat, e.lng, location.lat, location.lng) > location.radius_km) return false;
    }
    return genre === "ALL" || (e.genre ?? "").toUpperCase() === genre.toUpperCase();
  });

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
        <LocationPicker
          current={location}
          onChange={(loc) => {
            setLocation(loc);
            refreshCityEvents(loc);
            // Re-fetch events on the server so newly-synced rows for this
            // city show up in the feed.
            router.refresh();
          }}
        />
      </div>

      {shelf}

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
          <div className="ev-list">
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
                  <div className="ev-artist">
                    {ev.artist}
                    {(ev as { is_owned?: boolean }).is_owned && <span className="rbadge">R◉</span>}
                  </div>
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
        </div>
      ))}
    </div>
  );
}
