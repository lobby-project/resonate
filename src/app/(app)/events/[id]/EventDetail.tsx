"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleGoingDetail } from "./actions";
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
  const [going, setGoing] = useState(event.is_going);
  const [count, setCount] = useState(event.going_count);
  const [busy, setBusy] = useState(false);
  // Going unlocks the tabs; navigation always defaults to Detail.
  const [tab, setTab] = useState<Tab>("detail");
  const glow = GLOWS[event.genre ?? ""] ?? "rgba(57,255,20,.5)";

  async function onToggle() {
    setBusy(true);
    const next = !going;
    setGoing(next);
    setCount((c) => c + (next ? 1 : -1));
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

  // ----- Detail content: poster block (independent, clear) then layered info -----
  const poster = event.poster_url || event.cover_url;

  const detailBody = (
    <>
      {/* POSTER — independent block, fixed 4:5 frame, object-fit cover, hard border */}
      <div
        className="dotgrid"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 5",
          border: "1px solid var(--border)",
          background: "var(--panel)",
          overflow: "hidden",
          marginBottom: 22,
        }}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={event.artist}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 38%, ${glow}, transparent 70%)` }} />
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ndot)", fontSize: 120, lineHeight: 1, color: "rgba(255,255,255,.12)" }}>
              {event.artist[0]}
            </span>
          </>
        )}
      </div>

      {/* 1 — TITLE: biggest / heaviest / white */}
      <h1 style={{ fontFamily: "var(--ndot)", fontSize: 30, lineHeight: 1.05, letterSpacing: ".01em", color: "var(--white)", margin: "0 0 12px" }}>
        {event.artist}
      </h1>

      {/* 2 — TIME: the focal point, neon green */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 16, letterSpacing: ".06em", color: "var(--green)", textShadow: "0 0 14px rgba(57,255,20,.35)", marginBottom: 16 }}>
        {prettyDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ""}
      </div>

      {/* 3 + 4 — VENUE / PRICE / GOING: secondary, gray, small with glyphs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".06em", color: "var(--gray)" }}>
          <span aria-hidden style={{ fontSize: 11, color: "var(--gray3)" }}>◎</span>
          {event.venue ?? "VENUE TBA"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".06em", color: "var(--gray)" }}>
          <span aria-hidden style={{ fontSize: 11, color: "var(--gray3)" }}>◇</span>
          {priceLabel} · {pad(count)} GOING
        </div>
      </div>

      <hr className="dashed" />

      {/* 5 — YOUR MATCH / ABOUT / buy / going (logic unchanged, spacing harmonized) */}
      <div style={{ textAlign: "center", margin: "10px 0 6px" }}>
        <div className="label" style={{ marginBottom: 8 }}>YOUR MATCH</div>
        <div className="match-huge">{pad(event.match)}%</div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "var(--gray)", marginTop: 6 }}>
          {event.genre?.toUpperCase() ?? ""}
        </div>
      </div>

      {event.description && (
        <>
          <hr className="dashed" />
          <div className="label" style={{ marginBottom: 10 }}>ABOUT</div>
          <p className="about-text">{event.description}</p>
        </>
      )}

      <hr className="dashed" />

      {/* 自办活动:站内购票/RSVP 面板;聚合活动:外链购票 */}
      {event.is_owned && <BuyPanel eventId={event.id} />}
      {!event.is_owned && event.ticket_url && (
        <a className="btn-out" href={event.ticket_url} target="_blank" rel="noopener noreferrer">
          GET TICKETS ↗
        </a>
      )}

      <div style={{ marginTop: 18 }}>
        <button className={"btn-going" + (going ? " on" : "")} disabled={busy} onClick={onToggle}>
          {going ? "✓ GOING" : "I'M GOING"}
        </button>
      </div>
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
