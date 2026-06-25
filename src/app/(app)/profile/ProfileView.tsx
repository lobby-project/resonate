"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FullProfile, ProfileShow } from "@/lib/profile";
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

const GENDERS: [string, string][] = [
  ["male", "MALE"],
  ["female", "FEMALE"],
  ["nonbinary", "NON-BINARY"],
  ["undisclosed", "PREFER NOT TO SAY"],
];
const GENDER_LABEL: Record<string, string> = Object.fromEntries(GENDERS);
const igHandleClean = (h: string) => h.trim().replace(/^@+/, "");

// one show row — links to the event detail
function ShowRow({ s }: { s: ProfileShow }) {
  const meta = [s.venue, s.event_date, s.event_time].filter(Boolean).join(" · ");
  return (
    <Link href={`/events/${s.id}`} className="ev-row" style={{ textDecoration: "none" }}>
      <div className="ev-cover dotgrid">
        {s.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.cover_url} alt={s.artist} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ position: "relative", zIndex: 2 }}>{s.artist[0]}</span>
        )}
      </div>
      <div className="ev-body">
        <div className="ev-artist">
          {s.artist}
          {s.hasTicket && <span className="rbadge">TICKET</span>}
        </div>
        <div className="ev-meta">{meta || "—"}</div>
      </div>
    </Link>
  );
}

export default function ProfileView({ data, self }: { data: FullProfile; self: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(data.name);
  const [age, setAge] = useState<number | null>(data.age);
  const [gender, setGender] = useState<string>(data.gender ?? "");
  const [ig, setIg] = useState(data.igHandle ?? "");
  const [bio, setBio] = useState(data.bio ?? "");
  const [genres, setGenres] = useState<string[]>(
    data.genres.map((g) => g.toUpperCase())
  );
  const [photos, setPhotos] = useState<string[]>(data.photos);

  const [editAbout, setEditAbout] = useState(false);
  const [editGenres, setEditGenres] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ---- about (name/age/gender/ig/bio) ----
  async function saveAbout() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await updateBasicInfo(name, age ?? 0, gender, ig, bio);
      setEditAbout(false);
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
  const genderLabel = gender ? GENDER_LABEL[gender] ?? null : null;
  const ig0 = igHandleClean(ig);

  return (
    <div className="screen">
      <div className="app-head">
        {self ? (
          <div className="brand">PROFILE</div>
        ) : (
          <button className="btn-link" onClick={() => router.back()}>← BACK</button>
        )}
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
          {self && (
            <div className="mono" style={{ fontSize: 9, letterSpacing: ".1em", color: "var(--gray3)", marginTop: 4 }}>
              {data.isSpotify ? "SPOTIFY-LINKED" : "MANUAL SIGNAL"}
            </div>
          )}
        </div>
      </div>

      <hr className="dashed" />

      {/* ABOUT */}
      <div className="prof-section">
        <div className="prof-row">
          <span className="label">ABOUT</span>
          {self && (
            <button className="btn-link" onClick={() => setEditAbout((v) => !v)}>
              {editAbout ? "CANCEL" : "EDIT"}
            </button>
          )}
        </div>

        {self && editAbout ? (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="NAME" className="prof-input" />
            <input
              value={age ?? ""}
              onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="AGE"
              type="number"
              className="prof-input"
            />
            <div className="genre-grid">
              {GENDERS.map(([val, lbl]) => (
                <button
                  key={val}
                  className={"genre-chip" + (gender === val ? " on" : "")}
                  onClick={() => setGender(val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@INSTAGRAM" className="prof-input" />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="BIO — A LINE ABOUT YOU"
              maxLength={300}
              rows={3}
              className="prof-input"
              style={{ resize: "none", fontFamily: "var(--mono)" }}
            />
            <button className="btn-primary" disabled={busy || !name.trim()} onClick={saveAbout}>
              {busy ? "SAVING..." : "SAVE"}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {bio ? (
              <div className="mono" style={{ fontSize: 12, lineHeight: 1.6, color: "#fff", whiteSpace: "pre-wrap" }}>{bio}</div>
            ) : (
              self && <div className="mono" style={{ fontSize: 11, color: "var(--gray3)" }}>NO BIO YET</div>
            )}
            <div className="chiprow" style={{ gap: 8, flexWrap: "wrap" }}>
              {genderLabel && <span className="chip">{genderLabel}</span>}
              {ig0 && (
                <a
                  href={`https://instagram.com/${ig0}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip"
                  style={{ textDecoration: "none" }}
                >
                  IG @{ig0}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <hr className="dashed" />

      {/* SHOWS */}
      {data.upcoming.length === 0 && data.past.length === 0 ? (
        <div className="prof-section">
          <span className="label">SHOWS</span>
          <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--gray3)" }}>
            {self ? "NO SHOWS YET — MARK GOING ON EVENTS" : "NO SHOWS YET"}
          </div>
        </div>
      ) : (
        <>
          {data.upcoming.length > 0 && (
            <div className="prof-section">
              <span className="label">UPCOMING · {data.upcoming.length}</span>
              <div className="ev-list" style={{ marginTop: 8 }}>
                {data.upcoming.map((s) => <ShowRow key={s.id} s={s} />)}
              </div>
            </div>
          )}
          {data.past.length > 0 && (
            <div className="prof-section">
              <span className="label">PAST SHOWS · {data.past.length}</span>
              <div className="ev-list" style={{ marginTop: 8 }}>
                {data.past.map((s) => <ShowRow key={s.id} s={s} />)}
              </div>
            </div>
          )}
        </>
      )}

      <hr className="dashed" />

      {/* PHOTOS */}
      <div className="prof-section">
        <div className="prof-row">
          <span className="label">PHOTOS · {photos.length}</span>
          {self && (
            <button
              className="btn-link"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || photos.length >= 6}
            >
              {uploading ? "UPLOADING..." : photos.length >= 6 ? "MAX 6" : "+ ADD"}
            </button>
          )}
        </div>
        {self && (
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: "none" }} />
        )}
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
              {self && (
                <button className="prof-photo-del" onClick={() => deletePhoto(url)} aria-label="Remove">✕</button>
              )}
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
          <span className="label">GENRES · {genres.length}{self ? "/5" : ""}</span>
          {self && (
            <button className="btn-link" onClick={() => setEditGenres((v) => !v)}>
              {editGenres ? "CANCEL" : "EDIT"}
            </button>
          )}
        </div>
        {self && editGenres ? (
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

      {/* SETTINGS — self only */}
      {self && (
        <>
          <hr className="dashed" />
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
        </>
      )}
    </div>
  );
}
