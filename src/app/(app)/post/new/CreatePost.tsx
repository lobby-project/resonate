"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "./actions";

export type GoingEventOption = { id: string; artist: string };

export default function CreatePost({
  userId,
  events,
}: {
  userId: string;
  events: GoingEventOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // tag mode: event | artist
  const [tagMode, setTagMode] = useState<"event" | "artist">(events.length ? "event" : "artist");
  const [eventId, setEventId] = useState<string | null>(events[0]?.id ?? null);
  const [artist, setArtist] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("post-media")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("post-media").getPublicUrl(path);
      setMedia(pub.publicUrl);
    } catch (e) {
      console.error("upload failed", e);
      setErr("Photo upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    setErr(null);
    const tagOk = tagMode === "event" ? !!eventId : !!artist.trim();
    if (!tagOk) {
      setErr(tagMode === "event" ? "Pick an event" : "Type an artist");
      return;
    }
    if (!title.trim() && !caption.trim() && !media) {
      setErr("Add a title, text, or a photo");
      return;
    }
    setBusy(true);
    try {
      await createPost({
        title,
        caption,
        mediaUrl: media,
        eventId: tagMode === "event" ? eventId : null,
        artist: tagMode === "artist" ? artist : null,
      });
      // createPost redirects to /discover on success
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to post");
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="backbar">
        <button className="back-btn" onClick={() => router.back()}>←</button>
        <span>NEW POST</span>
      </div>

      {/* title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="TITLE"
        maxLength={80}
        className="prof-input"
        style={{ marginBottom: 10, fontFamily: "var(--ndot)", fontSize: 15 }}
      />

      {/* body */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="WHAT'S THE VIBE? (BODY)"
        maxLength={500}
        className="post-caption"
      />

      {/* media */}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />
      {media ? (
        <div
          className="post-media-prev dotgrid"
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid var(--border)",
            marginBottom: 4,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <button className="prof-photo-del" onClick={() => setMedia(null)} aria-label="Remove">✕</button>
        </div>
      ) : (
        <button className="btn-out" style={{ width: "100%" }} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "UPLOADING..." : "+ ADD PHOTO (OPTIONAL)"}
        </button>
      )}

      <hr className="dashed" />

      {/* tag — exactly one of event / artist */}
      <div className="label" style={{ marginBottom: 10 }}>TAG (REQUIRED · ONE)</div>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={tagMode === "event" ? "active" : ""} onClick={() => setTagMode("event")}>EVENT</button>
        <button className={tagMode === "artist" ? "active" : ""} onClick={() => setTagMode("artist")}>ARTIST</button>
      </div>

      {tagMode === "event" ? (
        events.length ? (
          <div className="chiprow">
            {events.map((e) => (
              <button
                key={e.id}
                className={"chip" + (eventId === e.id ? " on" : "")}
                onClick={() => setEventId(e.id)}
              >
                {e.artist}
              </button>
            ))}
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 11, color: "var(--gray3)" }}>
            NO EVENTS YOU&apos;RE GOING TO · MARK ONE OR TAG AN ARTIST
          </div>
        )
      ) : (
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="ARTIST NAME (e.g. FRED AGAIN)"
          className="prof-input"
        />
      )}

      {err && <div className="mono" style={{ marginTop: 14, fontSize: 11, color: "#ff5050" }}>● {err.toUpperCase()}</div>}

      <div style={{ flex: 1, minHeight: 20 }} />
      <button className="btn-primary" disabled={busy || uploading} onClick={submit}>
        {busy ? "POSTING..." : "POST →"}
      </button>
    </div>
  );
}
