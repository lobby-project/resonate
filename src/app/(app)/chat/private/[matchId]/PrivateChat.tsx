"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendPrivateMessage } from "../../actions";

export type PrivateMsg = {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

export default function PrivateChat({
  matchId,
  otherName,
  myUserId,
  initialMessages,
}: {
  matchId: string;
  otherName: string;
  myUserId: string;
  initialMessages: PrivateMsg[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState<PrivateMsg[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`private-chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const m = payload.new as PrivateMsg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendPrivateMessage(matchId, body);
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="screen convo">
      <div className="convo-head">
        <button className="back-btn" onClick={() => router.back()}>←</button>
        <div className="ch-info">
          <div className="ch-name">{otherName}</div>
          <div className="ch-sub">● MATCHED · PRIVATE</div>
        </div>
      </div>

      <div className="msg-area">
        <div className="sys-line">— YOU MATCHED · SAY HI —</div>
        {messages.map((m) => {
          const mine = m.sender_id === myUserId;
          return (
            <div key={m.id} className={"msg " + (mine ? "me" : "them")}>
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
          placeholder="MESSAGE..."
          maxLength={500}
        />
        <button className="send-btn" onClick={send} disabled={sending}>↑</button>
      </div>
    </div>
  );
}
