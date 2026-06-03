"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendEventMessage } from "../../actions";

export type EventMsg = {
  id: string;
  anon_num: number;
  text: string;
  user_id: string;
  created_at: string;
};

export default function EventChat({
  eventId,
  artist,
  myUserId,
  myAnonNum,
  initialMessages,
}: {
  eventId: string;
  artist: string;
  myUserId: string;
  myAnonNum: number;
  initialMessages: EventMsg[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState<EventMsg[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // realtime subscription to this event's messages
  useEffect(() => {
    const channel = supabase
      .channel(`event-chat-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_messages",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const m = payload.new as EventMsg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendEventMessage(eventId, body);
      // realtime will append; nothing else needed
    } catch {
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="screen convo">
      <div className="convo-head">
        <button className="back-btn" onClick={() => router.back()}>←</button>
        <div className="ch-info">
          <div className="ch-name">{artist}</div>
          <div className="ch-sub">● EVENT CHAT · ANONYMOUS</div>
        </div>
      </div>

      <div className="msg-area">
        <div className="sys-line">— YOU ARE LISTENER #{String(myAnonNum).padStart(3, "0")} —</div>
        {messages.map((m) => {
          const mine = m.user_id === myUserId;
          return (
            <div key={m.id} className={"msg " + (mine ? "me" : "them")}>
              <div className="who">
                LISTENER #{String(m.anon_num).padStart(3, "0")}
                {mine ? <span className="desc"> (YOU)</span> : null}
              </div>
              <div className="bubble">{m.text}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="MESSAGE (ANONYMOUS)..."
          maxLength={500}
        />
        <button className="send-btn" onClick={send} disabled={sending}>↑</button>
      </div>
    </div>
  );
}
