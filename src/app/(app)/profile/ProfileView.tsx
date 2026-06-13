"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  updateBasicInfo,
  updateGenres,
  addPhoto,
  removePhoto,
  signOut,
} from "./actions";

const GENRES12 = [
  "ELECTRONIC / EDM", "HIP-HOP / RAP", "POP", "ROCK", "R&B / SOUL",
  "JAZZ / BLUES", "INDIE / ALTERNATIVE", "METAL / PUNK", "COUNTRY / FOLK",
  "LATIN", "REGGAE", "CLASSICAL / ORCHESTRA",
];

export type ProfileData = {
  userId: string;
  name: string;
  age: number | null;
  signal: string | null;
  genres: string[];
  photos: string[];
  isSpotify: boolean;
};

export default function ProfileView({ data }: { data: ProfileData }) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(data.name);
  const [age, setAge] = useState<number | null>(data.age);
  const [genres, setGenres] = useState<string[]>(
    data.genres.map((g) => g.toUpperCase())
  );
  const [photos, setPhotos] = useState<string[]>(data.photos);

  const [editInfo, setEditInfo] = useState(false);
  const [editGenres, setEditGenres] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ---- info ----
  async function saveInfo() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await updateBasicInfo(name, age ?? 0);
      setEditInfo(false);
    } finally {
      setBusy(false);
    }
  }

  // ---- genres ----
  function toggleGenre(g: string) {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length >= 5 ? prev : [...prev, g]
    );
  }
  async function saveGenresEdit() {
    if (genres.length < 1 || busy) return;
    setBusy(true);
    try {
      await updateGenres(genres);
      setEditGenres(false);
    } finally {
      setBusy(false);
    }
  }

  // ---- photos ----
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${data.userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("user-photos")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("user-photos").getPublicUrl(path);
      const url = pub.publicUrl;
      await addPhoto(url, photos.length);
      setPhotos((p) => [...p, url]);
    } catch (err) {
      console.error("photo upload failed", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function deletePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
    try {
      await removePhoto(url);
    } catch {
      setPhotos((p) => [...p, url]); // restore on failure
    }
  }

  const avatar = photos[0] ?? null;

  return (
    <div className="screen">
      <div className="app-head">
        <div className="brand">PROFILE</div>
      </div>

      {/* header card */}
      <div className="prof-head">
        <div
          className="prof-avatar dotgrid"
          style={{
            position: "relative",
            width: 76,
            height: 76,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
          }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ position: "relative", zIndex: 2 }}>{(name || "?")[0]}</span>
          )}
        </div>
        <div className="prof-id">
          <div className="prof-name">
            {name || "—"}{age ? <span className="prof-age"> / {age}</span> : null}
          </div>
          {data.signal && <div className="prof-signal">✦ {data.signal.toUpperCase()}</div>}
          <div className="mono" style={{ fontSize: 9, letterSpacing: ".1em", color: "var(--gray3)", marginTop: 4 }}>
            {data.isSpotify ? "SPOTIFY-LINKED" : "MANUAL SIGNAL"}
          </div>
        </div>
      </div>

      <hr className="dashed" />

      {/* INFO */}
      <div className="prof-section">
        <div className="prof-row">
          <span className="label">BASICS</span>
          <button className="btn-link" onClick={() => setEditInfo((v) => !v)}>
            {editInfo ? "CANCEL" : "EDIT"}
          </button>
        </div>
        {editInfo ? (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NAME"
              className="prof-input"
            />
            <input
              value={age ?? ""}
              onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="AGE"
              type="number"
              className="prof-input"
            />
            <button className="btn-primary" disabled={busy || !name.trim()} onClick={saveInfo}>
              {busy ? "SAVING..." : "SAVE"}
            </button>
          </div>
        ) : (
          <div className="mono" style={{ marginTop: 6, fontSize: 12, color: "#fff" }}>
            {name || "—"}{age ? `, ${age}` : ""}
          </div>
        )}
      </div>

      <hr className="dashed" />

      {/* PHOTOS */}
      <div className="prof-section">
        <div className="prof-row">
          <span className="label">PHOTOS · {photos.length}</span>
          <button
            className="btn-link"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || photos.length >= 6}
          >
            {uploading ? "UPLOADING..." : photos.length >= 6 ? "MAX 6" : "+ ADD"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />
        <div className="prof-photos">
          {photos.map((url) => (
            <div
              key={url}
              className="prof-photo dotgrid"
              style={{
                position: "relative",
                width: 88,
                height: 110,
                borderRadius: 8,
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid var(--border)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <button className="prof-photo-del" onClick={() => deletePhoto(url)} aria-label="Remove">✕</button>
            </div>
          ))}
          {photos.length === 0 && (
            <div className="mono" style={{ fontSize: 11, color: "var(--gray3)" }}>NO PHOTOS YET</div>
          )}
        </div>
      </div>

      <hr className="dashed" />

      {/* GENRES */}
      <div className="prof-section">
        <div className="prof-row">
          <span className="label">GENRES · {genres.length}/5</span>
          <button className="btn-link" onClick={() => setEditGenres((v) => !v)}>
            {editGenres ? "CANCEL" : "EDIT"}
          </button>
        </div>
        {editGenres ? (
          <>
            <div className="genre-grid" style={{ marginTop: 10 }}>
              {GENRES12.map((g) => {
                const sel = genres.includes(g);
                const lock = !sel && genres.length >= 5;
                return (
                  <button
                    key={g}
                    className={"genre-chip" + (sel ? " on" : "")}
                    disabled={lock}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            {!data.isSpotify && (
              <div className="mono" style={{ marginTop: 8, fontSize: 9, color: "var(--gray3)" }}>
                CHANGING GENRES WILL REBUILD YOUR SIGNAL
              </div>
            )}
            <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy || genres.length < 1} onClick={saveGenresEdit}>
              {busy ? "SAVING..." : "SAVE GENRES"}
            </button>
          </>
        ) : (
          <div className="chiprow" style={{ marginTop: 8 }}>
            {genres.length ? genres.map((g) => <span key={g} className="chip on">{g}</span>) : <span className="mono" style={{ fontSize: 11, color: "var(--gray3)" }}>NONE</span>}
          </div>
        )}
      </div>

      <hr className="dashed" />

      {/* SETTINGS */}
      <div className="prof-section">
        <span className="label">SETTINGS</span>
        <Link
          href="/tickets"
          className="btn-out"
          style={{ width: "100%", marginTop: 12, display: "block", textAlign: "center" }}
        >
          MY TICKETS
        </Link>
        <button
          className="btn-out"
          style={{ width: "100%", marginTop: 8 }}
          onClick={() => signOut()}
        >
          LOG OUT
        </button>
        <p className="mono" style={{ marginTop: 14, fontSize: 9, letterSpacing: ".1em", color: "var(--gray3)", textAlign: "center" }}>
          RESONATE · LA BETA
        </p>
      </div>
    </div>
  );
}
