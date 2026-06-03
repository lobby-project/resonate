"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { togglePostResonate } from "../new/actions";
import { addComment, deleteComment } from "./actions";
import TextCard from "../../discover/TextCard";

export type PostComment = {
  id: string;
  author: string;
  isMine: boolean;
  text: string;
};

export type PostDetailData = {
  id: string;
  author: string;
  isMine: boolean;
  mediaUrl: string | null;
  title: string;
  body: string;
  tag: string;
  tagType: "event" | "artist";
  likeCount: number;
  resonated: boolean;
  comments: PostComment[];
};

export default function PostDetail({ data }: { data: PostDetailData }) {
  const router = useRouter();

  const [resonated, setResonated] = useState(data.resonated);
  const [likeCount, setLikeCount] = useState(data.likeCount);
  const [comments, setComments] = useState<PostComment[]>(data.comments);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  async function toggleLike() {
    const next = !resonated;
    setResonated(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const res = await togglePostResonate(data.id);
      setResonated(res.resonated);
    } catch {
      setResonated(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  async function submitComment() {
    const t = draft.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await addComment(data.id, t);
      setComments((cs) => [...cs, { id: res.id, author: "YOU", isMine: true, text: t }]);
      setDraft("");
    } catch {
      // ignore; keep draft
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(id: string) {
    setComments((cs) => cs.filter((c) => c.id !== id));
    try {
      await deleteComment(id, data.id);
    } catch {
      /* best effort */
    }
  }

  async function share() {
    const url = `${window.location.origin}/post/${data.id}`;
    const shareData = { title: data.title || "Resonate post", text: data.body, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("LINK COPIED");
      setTimeout(() => setShareMsg(null), 1600);
    } catch {
      setShareMsg("COPY FAILED");
      setTimeout(() => setShareMsg(null), 1600);
    }
  }

  return (
    <div className="screen">
      <div className="backbar">
        <button className="back-btn" onClick={() => router.back()}>←</button>
        <span>POST</span>
      </div>

      {/* author + tag */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--ndot)", fontSize: 15, color: "#fff" }}>{data.author.toUpperCase()}</span>
        <span className="mono" style={{ fontSize: 9, letterSpacing: ".06em", color: data.tagType === "event" ? "var(--green)" : "#b98cff" }}>
          {data.tagType === "event" ? "◆" : "♫"} {data.tag.toUpperCase()}
        </span>
      </div>

      {/* visual */}
      {data.mediaUrl ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <TextCard seed={data.id} title={data.title} body={data.body} variant="full" />
      )}

      {/* title + body (for photo posts) */}
      {data.mediaUrl && (
        <>
          {data.title && <h1 style={{ fontFamily: "var(--ndot)", fontSize: 20, color: "#fff", marginTop: 14, lineHeight: 1.3 }}>{data.title}</h1>}
          {data.body && <p className="mono" style={{ fontSize: 13, color: "#ddd", lineHeight: 1.6, marginTop: 8 }}>{data.body}</p>}
        </>
      )}

      {/* action row */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className={"act-btn" + (resonated ? " on" : "")} onClick={toggleLike}>
          {resonated ? "✦" : "○"} {likeCount}
        </button>
        <button className="act-btn">💬 {comments.length}</button>
        <button className="act-btn" onClick={share}>↗ {shareMsg ?? "SHARE"}</button>
      </div>

      <hr className="dashed" />

      {/* comments */}
      <div className="label" style={{ marginBottom: 10 }}>COMMENTS · {comments.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {comments.length === 0 && (
          <span className="mono" style={{ fontSize: 11, color: "var(--gray3)" }}>NO COMMENTS YET · SAY SOMETHING</span>
        )}
        {comments.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontFamily: "var(--ndot)", fontSize: 12, color: "var(--green)", minWidth: 0, flexShrink: 0 }}>{c.author.toUpperCase()}</span>
            <span className="mono" style={{ fontSize: 12, color: "#ddd", flex: 1, lineHeight: 1.5 }}>{c.text}</span>
            {c.isMine && (
              <button onClick={() => removeComment(c.id)} className="mono" style={{ fontSize: 10, color: "var(--gray3)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* comment input */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
          placeholder="ADD A COMMENT..."
          className="prof-input"
          style={{ flex: 1 }}
        />
        <button className="btn-primary" style={{ width: "auto", padding: "0 18px" }} disabled={busy || !draft.trim()} onClick={submitComment}>
          {busy ? "..." : "SEND"}
        </button>
      </div>
    </div>
  );
}
