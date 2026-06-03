"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EventRoom = { id: string; artist: string; genre: string | null };
export type PrivateThread = { matchId: string; name: string; eventArtist: string | null };

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

export default function ChatList({
  rooms,
  threads,
}: {
  rooms: EventRoom[];
  threads: PrivateThread[];
}) {
  const [tab, setTab] = useState<"rooms" | "private">("rooms");
  const router = useRouter();

  return (
    <div className="screen">
      <div className="app-head">
        <div className="brand">CHAT</div>
      </div>

      <div className="subtabs">
        <button className={"subtab" + (tab === "rooms" ? " active" : "")} onClick={() => setTab("rooms")}>
          EVENT ROOMS
        </button>
        <button className={"subtab" + (tab === "private" ? " active" : "")} onClick={() => setTab("private")}>
          PRIVATE
        </button>
      </div>

      {tab === "rooms" && (
        <div>
          {rooms.length === 0 ? (
            <div className="empty">
              <span className="big">NO EVENT ROOMS</span>
              MARK A SHOW AS GOING TO JOIN ITS CHAT ●
            </div>
          ) : (
            rooms.map((r) => {
              const glow = GLOWS[r.genre ?? ""] ?? "rgba(57,255,20,.5)";
              return (
                <div key={r.id} className="chat-row" onClick={() => router.push(`/chat/event/${r.id}`)}>
                  <div className="chat-ava dotgrid">
                    <div className="cv-glow" style={{ background: `radial-gradient(circle at 50% 40%, ${glow}, transparent 70%)` }} />
                    <span style={{ position: "relative", zIndex: 2 }}>{r.artist[0]}</span>
                  </div>
                  <div className="chat-main">
                    <div className="chat-name">{r.artist}</div>
                    <div className="chat-prev"><b>ANONYMOUS</b> · TAP TO ENTER ROOM</div>
                  </div>
                  <span className="badge dim">ROOM</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "private" && (
        <div>
          {threads.length === 0 ? (
            <div className="empty">
              <span className="big">NO MATCHES YET</span>
              MATCH WITH SOMEONE AT A SHOW TO START CHATTING ●
            </div>
          ) : (
            threads.map((t) => (
              <div key={t.matchId} className="chat-row" onClick={() => router.push(`/chat/private/${t.matchId}`)}>
                <div className="chat-ava circle dotgrid">
                  <div className="cv-glow" style={{ background: "radial-gradient(circle at 50% 40%, rgba(57,255,20,.5), transparent 70%)" }} />
                  <span style={{ position: "relative", zIndex: 2 }}>{(t.name || "?")[0]}</span>
                </div>
                <div className="chat-main">
                  <div className="chat-name">{t.name}</div>
                  <div className="chat-prev">{t.eventArtist ? `MATCHED AT ${t.eventArtist.toUpperCase()}` : "MATCHED"}</div>
                </div>
                <span className="badge">NEW</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
