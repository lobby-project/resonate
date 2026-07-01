"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toggleGoingDetail } from "./actions";
import { logEvent } from "@/lib/analytics";
import { cleanRef, storeRef, readRef } from "@/lib/channel";
import BuyPanel from "@/components/ticketing/BuyPanel";
import EventChat, { type EventMsg } from "@/app/(app)/chat/event/[id]/EventChat";
import SwipeDeck from "@/app/(app)/discover/SwipeDeck";

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
  city: string | null;
  going_count: number;
  is_going: boolean;
  match: number;
  is_owned?: boolean;
  poster_url?: string | null;
};

// Server-loaded data for the Chat tab (only present when already going).
export type EventChatData = {
  myUserId: string;
  myAnonNum: number;
  initialMessages: EventMsg[];
};

function prettyDate(dateStr: string | null): string {
  if (!dateStr) return "DATE TBA";
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

type Tab = "detail" | "chat" | "people";

export default function EventDetail({
  event,
  chat,
}: {
  event: DetailEvent;
  chat: EventChatData | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [going, setGoing] = useState(event.is_going);
  const [busy, setBusy] = useState(false);
  // Going unlocks the tabs; navigation always defaults to Detail.
  const [tab, setTab] = useState<Tab>("detail");
  const glow = GLOWS[event.genre ?? ""] ?? "rgba(57,255,20,.5)";

  // funnel: detail_view — client-side so it fires on a real page open, not on
  // Next prefetch/refresh. Re-fires if navigating to a different event.
  // Channel attribution: capture ?ref= as last-touch (localStorage) and log the
  // effective ref into the detail_view metadata (click-side channel data).
  const urlRef = cleanRef(searchParams.get("ref"));
  useEffect(() => {
    if (urlRef) storeRef(urlRef); // last-touch: only overwrite when a new ref arrives
    const ref = urlRef ?? readRef();
    logEvent("detail_view", { eventId: event.id, metadata: ref ? { ref } : undefined });
  }, [event.id, urlRef]);

  async function onToggle() {
    setBusy(true);
    const next = !going;
    setGoing(next);
    try {
      await toggleGoingDetail(event.id);
      if (next) {
        // Unlock tabs but stay on Detail; refresh pulls the now-available chat
        // data (anon_num + messages) from the server without leaving the page.
        router.refresh();
      } else {
        setTab("detail");
      }
    } catch {
      setGoing(!next);
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

  // ----- Detail content: responsive two-column (poster | info); ABOUT spans below -----
  const poster = event.poster_url || event.cover_url;

  const detailBody = (
    <>
      <div className="ed-detail">
        {/* POSTER — enlarged frame (4:5), genre glow halo, hard border, dot-grid */}
        <div className="ed-poster-wrap">
          <div className="ed-poster-glow" style={{ background: `radial-gradient(circle at 50% 40%, ${glow}, transparent 70%)` }} />
          <div className="ed-poster dotgrid">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt={event.artist} />
            ) : (
              <>
                <div style={{ position: "absolute", inset: 0, opacity: 0.5, zIndex: 0, background: `radial-gradient(circle at 50% 40%, ${glow}, transparent 68%)` }} />
                <span className="ed-poster-letter">{event.artist[0]}</span>
              </>
            )}
          </div>
        </div>

        {/* INFO — desktop right column / mobile below the poster */}
        <div className="ed-info">
          <h1 className="ed-title">{event.artist}</h1>

          <div className="ed-venue">
            <span aria-hidden className="ed-ic">◎</span>
            {event.venue ?? "VENUE TBA"}
          </div>

          {/* time = the focal point, neon green */}
          <div className="ed-time">
            {prettyDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ""}
          </div>

          {event.city && (
            <div className="ed-city">
              <span aria-hidden className="ed-ic dim">◎</span>
              {event.city}
            </div>
          )}

          {/* action block — lifted onto a card so it reads as the primary action */}
          <div className="ed-cta">
            {event.is_owned ? (
              <BuyPanel eventId={event.id} />
            ) : event.ticket_url ? (
              <div className="card">
                <div className="ed-price">{priceLabel}</div>
                <a className="btn-out" href={event.ticket_url} target="_blank" rel="noopener noreferrer">
                  GET TICKETS ↗
                </a>
              </div>
            ) : null}
            <button className={"btn-going" + (going ? " on" : "")} disabled={busy} onClick={onToggle}>
              {going ? "✓ GOING" : "I'M GOING"}
            </button>
          </div>
        </div>
      </div>

      {/* ABOUT — spans full width below the two columns */}
      {event.description && (
        <div className="ed-about">
          <div className="label" style={{ marginBottom: "var(--sp-3)" }}>ABOUT</div>
          <p className="about-text">{event.description}</p>
        </div>
      )}
    </>
  );

  // ----- Chat tab: pinned bar (venue + start time) above the anonymous chat -----
  const chatBody = (
    <>
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          gap: 10,
          alignItems: "center",
          margin: "8px 18px 0",
          padding: "10px 12px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderLeft: "2px solid var(--green)",
          borderRadius: 8,
        }}
      >
        <span className="dot green" style={{ fontSize: 14, lineHeight: 1 }}>●</span>
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 11, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {event.venue ?? "VENUE TBA"}
          </div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: ".1em", color: "var(--gray)", marginTop: 2 }}>
            {prettyDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ""}
          </div>
        </div>
      </div>
      {chat ? (
        <EventChat
          embedded
          eventId={event.id}
          artist={event.artist}
          myUserId={chat.myUserId}
          myAnonNum={chat.myAnonNum}
          initialMessages={chat.initialMessages}
        />
      ) : (
        <div className="screen convo" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="empty">CONNECTING… ●</div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* fixed header: back + (when going) tab bar */}
      <div style={{ flex: "0 0 auto", padding: "4px 18px 0" }}>
        <div className="backbar">
          {/* From Chat/People, back returns to this event's Detail; from Detail
              it leaves the page. Keeps tab nav inside the event. */}
          <button
            className="back-btn"
            onClick={() => { if (tab !== "detail") setTab("detail"); else router.back(); }}
          >
            ←
          </button>
          <span>EVENT</span>
        </div>
        {going && (
          <div className="subtabs">
            <button className={"subtab" + (tab === "detail" ? " active" : "")} onClick={() => setTab("detail")}>DETAIL</button>
            <button className={"subtab" + (tab === "chat" ? " active" : "")} onClick={() => setTab("chat")}>CHAT</button>
            <button className={"subtab" + (tab === "people" ? " active" : "")} onClick={() => setTab("people")}>PEOPLE</button>
          </div>
        )}
      </div>

      {/* tab content area */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* not going → only Detail; going → switch by tab */}
        {(!going || tab === "detail") && (
          <div className="screen" style={{ paddingTop: 8 }}>
            {detailBody}
          </div>
        )}
        {going && tab === "chat" && chatBody}
        {going && tab === "people" && (
          <div className="screen noscroll">
            <div className="people-wrap">
              <SwipeDeck eventId={event.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
