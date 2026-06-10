"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  saveBasicInfo,
  saveGenres,
  savePhotoUrl,
  removePhotoUrl,
  completeOnboarding,
  getMySignal,
  buildManualSignal,
} from "./actions";
import { OnboardingLocation } from "@/components/OnboardingLocation";
import { useLocation } from "@/lib/geo/LocationProvider";
import { refreshCityEvents } from "@/lib/geo/types";

const GENRES12 = [
  "ELECTRONIC / EDM", "HIP-HOP / RAP", "POP", "ROCK",
  "R&B / SOUL", "JAZZ / BLUES", "INDIE / ALTERNATIVE", "METAL / PUNK",
  "COUNTRY / FOLK", "LATIN", "REGGAE", "CLASSICAL / ORCHESTRA",
];

const GLOWS = [
  "rgba(57,255,20,.5)", "rgba(150,80,255,.5)", "rgba(60,140,255,.5)",
  "rgba(40,220,220,.5)", "rgba(255,180,40,.5)", "rgba(255,60,60,.5)",
];

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

type Photo = { id: number; url: string; uploading?: boolean };

export default function OnboardingPage() {
  // steps: 1 signal reveal, 2 location, 3 photos, 4 info, 5 genres, 6 done
  const [step, setStep] = useState(1);
  const { setLocation } = useLocation();

  // signal (real)
  const [signal, setSignal] = useState<string | null>(null);
  const [topArtists, setTopArtists] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [prog, setProg] = useState(0);
  const [phase, setPhase] = useState(0);

  // manual path (Google / phone users without Spotify data)
  const [needsManual, setNeedsManual] = useState<boolean | null>(null);
  const [manualArtists, setManualArtists] = useState("");

  // profile
  const [name, setName] = useState("");
  const [age, setAge] = useState(24);
  const [genres, setGenres] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoIdRef = useRef(1);
  const [popId, setPopId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  // fetch real signal on mount
  useEffect(() => {
    getMySignal().then(({ signal, topArtists, displayName }) => {
      setSignal(signal);
      setTopArtists(topArtists);
      setNeedsManual(signal === null); // no Spotify-derived signal → manual path
      if (displayName) setName(displayName.toUpperCase());
    });
  }, []);

  // analyze animation then reveal (step 1) — only for the Spotify (auto) path
  useEffect(() => {
    if (step !== 1 || needsManual !== false) return;
    setProg(0); setPhase(0); setRevealed(false);
    let p = 0;
    const iv = setInterval(() => {
      p += 2;
      setProg(Math.min(p, 100));
      setPhase(p < 34 ? 0 : p < 68 ? 1 : 2);
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => setRevealed(true), 350);
      }
    }, 48);
    return () => clearInterval(iv);
  }, [step, needsManual]);

  const ANALYZE_LINES = [
    "READING YOUR MUSIC DNA...",
    "ANALYZING YOUR TOP ARTISTS...",
    "CALCULATING YOUR SIGNAL...",
  ];

  // ---- photo upload to Supabase Storage ----
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || photos.length >= 5) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    for (const file of Array.from(files)) {
      if (photos.length >= 5) break;
      const id = photoIdRef.current++;
      setPopId(id);
      setTimeout(() => setPopId(null), 950);

      // temporary placeholder while uploading
      setPhotos((p) => [...p, { id, url: "", uploading: true }]);

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("user-photos")
        .upload(path, file, { upsert: false });

      if (upErr) {
        console.error("upload failed:", upErr.message);
        setPhotos((p) => p.filter((x) => x.id !== id));
        continue;
      }
      const { data: pub } = supabase.storage.from("user-photos").getPublicUrl(path);
      const url = pub.publicUrl;
      setPhotos((p) => p.map((x) => (x.id === id ? { ...x, url, uploading: false } : x)));
      await savePhotoUrl(url, id);
    }
    e.target.value = "";
  }

  async function rmPhoto(id: number) {
    const ph = photos.find((x) => x.id === id);
    setPhotos((p) => p.filter((x) => x.id !== id));
    if (ph?.url) await removePhotoUrl(ph.url);
  }

  const toggleGenre = (g: string) =>
    setGenres((gs) =>
      gs.includes(g) ? gs.filter((x) => x !== g) : gs.length >= 5 ? gs : [...gs, g]
    );

  const photoCount = photos.length;
  const photoOk = photoCount >= 3;

  // ---- step transitions that persist data ----
  async function buildManual() {
    if (genres.length < 1 || busy) return;
    setBusy(true);
    try {
      const artists = manualArtists
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      const { signal: s } = await buildManualSignal(genres, artists);
      setSignal(s);
      setTopArtists(artists.map((a) => a.toUpperCase()));
      setRevealed(true); // jump straight to reveal (no analyze animation)
    } finally {
      setBusy(false);
    }
  }

  async function fromInfo() {
    setBusy(true);
    try {
      await saveBasicInfo(name, age);
      // manual users already saved genres during signal build → skip genre step
      setStep(needsManual ? 6 : 5);
    } finally {
      setBusy(false);
    }
  }
  async function fromGenres() {
    setBusy(true);
    try { await saveGenres(genres); setStep(6); }
    finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true);
    try { await completeOnboarding(); } // redirects to /events
    finally { setBusy(false); }
  }

  const ObTop = ({ filled, tag }: { filled: number; tag: string }) => (
    <div className="ob-progress" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={"ob-dot" + (i < filled ? " on" : "")} />
        ))}
      </div>
      <span className="ob-step-tag">{tag}</span>
    </div>
  );

  return (
    <div className="app-frame atmos-scanlines">
      <div className="statusbar">
        <span>9:41</span>
        <span className="sb-dots">● ● ● ●</span>
        <span>100%</span>
      </div>

      {/* STEP 1 — SIGNAL (manual build for Google users, else analyze+reveal) */}
      {step === 1 && needsManual && !revealed && (
        <div className="ob-screen">
          <div className="sig-label" style={{ marginTop: 8 }}>✦ BUILD YOUR MUSIC SIGNAL</div>
          <div className="ob-title" style={{ marginTop: 14 }}>WHAT DO YOU LISTEN TO?</div>
          <div className="ob-sub">PICK UP TO 5 GENRES · {genres.length}/5 · WE&apos;LL CRAFT YOUR SIGNAL</div>
          <div className="genre-grid">
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
          <div style={{ marginTop: 18 }}>
            <label className="label-green">FAVORITE ARTISTS (OPTIONAL)</label>
            <input
              value={manualArtists}
              onChange={(e) => setManualArtists(e.target.value)}
              placeholder="e.g. FRED AGAIN, SZA, TAME IMPALA"
              className="mono"
              style={{ width: "100%", marginTop: 8, background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 6, padding: "12px", color: "#fff", fontSize: 12, outline: "none" }}
            />
            <div className="mono" style={{ marginTop: 6, fontSize: 8, letterSpacing: ".1em", color: "var(--gray3)" }}>
              COMMA-SEPARATED · USED ON YOUR PROFILE
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 16 }} />
          <button className="btn-primary" disabled={genres.length < 1 || busy} onClick={buildManual}>
            {busy ? "CRAFTING..." : "GENERATE MY SIGNAL →"}
          </button>
        </div>
      )}

      {/* STEP 1 — SIGNAL REVEAL (Spotify analyze animation, or revealed manual signal) */}
      {step === 1 && !(needsManual && !revealed) && (
        <div className="ob-screen" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          {!revealed ? (
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
                {ANALYZE_LINES.map((l, i) => (
                  <div
                    key={i}
                    className="mono"
                    style={{
                      fontSize: 11, letterSpacing: ".14em",
                      color: i === phase ? "var(--green)" : i < phase ? "#666" : "#333",
                    }}
                  >
                    ▸ {l}
                  </div>
                ))}
              </div>
              <div style={{ width: 200, height: 2, background: "var(--border)", margin: "0 auto", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--green)", width: prog + "%", transition: "width .1s linear" }} />
              </div>
              <div className="mono" style={{ marginTop: 10, fontSize: 11, color: "var(--green)" }}>{pad(prog)}%</div>
            </div>
          ) : (
            <div style={{ animation: "fadeIn .5s ease" }}>
              <div className="sig-label">✦ YOUR MUSIC SIGNAL</div>
              <div className="sig-name" style={{ margin: "18px 0" }}>
                {(signal ?? "NEW MUSIC HUNTER").toUpperCase()}
              </div>
              {topArtists.length > 0 && (
                <div className="sig-driven">
                  DRIVEN BY <b>{topArtists.join(", ").toUpperCase()}</b>
                </div>
              )}
              <div className="ob-foot-note" style={{ marginTop: 22 }}>✦ ONE OF 25 RESONATE SIGNALS</div>
              <div style={{ marginTop: 36 }}>
                <button className="btn-primary" onClick={() => setStep(2)}>CONTINUE →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — LOCATION (auto geolocate; fallback to manual city search) */}
      {step === 2 && (
        <div className="ob-screen" style={{ justifyContent: "center", textAlign: "left" }}>
          <div className="sig-label" style={{ marginTop: 8 }}>✦ FIND YOUR SCENE</div>
          <div className="ob-title" style={{ marginTop: 14 }}>WHERE ARE YOU?</div>
          <div className="ob-sub">SHOWS NEAR YOU. WE&apos;LL ASK FOR LOCATION ACCESS.</div>
          <div style={{ marginTop: 28 }}>
            <OnboardingLocation
              onResolved={(loc) => {
                setLocation(loc);
                refreshCityEvents(loc);
                setStep(3);
              }}
            />
          </div>
        </div>
      )}

      {/* STEP 3 — PHOTOS */}
      {step === 3 && (
        <div className="ob-screen">
          <ObTop filled={1} tag="STEP 01 / 03" />
          <div className="ob-title">ADD YOUR PHOTOS</div>
          <div className="ob-sub">3–5 PHOTOS. AT LEAST ONE CLEAR FACE. LIFESTYLE &amp; SHOW PHOTOS WELCOME.</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 24 }}>
            {photos.map((p, i) => (
              <div
                key={p.id}
                className="dotgrid"
                style={{
                  aspectRatio: "3/4", borderRadius: 6, border: `1px solid var(--green)`,
                  position: "relative", overflow: "hidden",
                  transform: p.id === popId ? "scale(1.04)" : "scale(1)", transition: "transform .25s",
                }}
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${GLOWS[i % GLOWS.length]}, transparent 70%)` }} />
                )}
                <span className="mono" style={{ position: "absolute", top: 6, left: 6, fontSize: 8, color: "rgba(255,255,255,.6)" }}>
                  {p.uploading ? "···" : `IMG_${pad(i + 1)}`}
                </span>
                <button
                  onClick={() => rmPhoto(p.id)}
                  style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 99, border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer", fontSize: 11 }}
                >×</button>
              </div>
            ))}
            {photoCount < 5 && (
              <label
                className="dotgrid"
                style={{
                  aspectRatio: "3/4", borderRadius: 6, border: `1px dashed var(--border)`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--gray)", gap: 4,
                }}
              >
                <span style={{ fontSize: 24 }}>+</span>
                <span className="mono" style={{ fontSize: 8, letterSpacing: ".12em" }}>ADD</span>
                <input type="file" accept="image/*" multiple hidden onChange={handleFileSelect} />
              </label>
            )}
          </div>

          <div className="mono" style={{ marginTop: 12, fontSize: 9, letterSpacing: ".1em", color: photoOk ? "var(--green)" : "var(--gray3)" }}>
            {photoOk ? `${photoCount}/5 ADDED · ✓ READY` : `${photoCount}/5 ADDED · NEED ${3 - photoCount} MORE`}
          </div>

          <div style={{ flex: 1 }} />
          <button className="btn-primary" disabled={!photoOk} onClick={() => setStep(4)}>CONTINUE →</button>
        </div>
      )}

      {/* STEP 4 — INFO */}
      {step === 4 && (
        <div className="ob-screen">
          <ObTop filled={2} tag="STEP 02 / 03" />
          <div className="ob-title">ABOUT YOU</div>
          <div className="ob-sub">THE BASICS. KEEP IT REAL.</div>

          <div style={{ marginTop: 26 }}>
            <label className="label-green">NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              maxLength={20}
              placeholder="YOUR NAME"
              className="mono"
              style={{ width: "100%", marginTop: 8, background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 6, padding: "12px", color: "#fff", fontSize: 13, outline: "none" }}
            />
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="row-between">
              <label className="label-green">AGE</label>
              <span className="dot" style={{ color: "var(--green)", fontSize: 18 }}>{age}</span>
            </div>
            <input
              type="range" min={18} max={32} value={age}
              onChange={(e) => setAge(+e.target.value)}
              style={{ width: "100%", marginTop: 12, accentColor: "var(--green)" }}
            />
            <div className="row-between mono" style={{ fontSize: 9, color: "var(--gray3)" }}>
              <span>18</span><span>32</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <button className="btn-primary" disabled={!name.trim() || busy} onClick={fromInfo}>
            {busy ? "SAVING..." : "CONTINUE →"}
          </button>
        </div>
      )}

      {/* STEP 5 — GENRES */}
      {step === 5 && (
        <div className="ob-screen">
          <ObTop filled={3} tag="STEP 03 / 03" />
          <div className="ob-title">YOUR GENRES</div>
          <div className="ob-sub">PICK UP TO 5 · {genres.length}/5 SELECTED</div>
          <div className="genre-grid">
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
          <div style={{ flex: 1, minHeight: 16 }} />
          <button className="btn-primary" disabled={genres.length < 1 || busy} onClick={fromGenres}>
            {busy ? "SAVING..." : "CONTINUE →"}
          </button>
        </div>
      )}

      {/* STEP 6 — DONE */}
      {step === 6 && (
        <div className="ob-screen" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: "100%" }}>
            <div className="dot" style={{ fontSize: 40, color: "var(--green)" }}>✦</div>
            <div className="ob-title" style={{ marginTop: 12 }}>YOU&apos;RE IN</div>
            <div style={{ marginTop: 24, border: "1px dashed var(--border)", borderRadius: 8, padding: 18, textAlign: "left" }}>
              {[
                ["WELCOME", (name.trim() || "FRIEND").toUpperCase(), true],
                ["SIGNAL", (signal ?? "NEW MUSIC HUNTER").toUpperCase(), false],
                ["GENRES", `${pad(genres.length)} SELECTED`, false],
                ["PHOTOS", `${pad(photoCount)} ADDED`, false],
              ].map(([k, v, gr]) => (
                <div key={k as string} className="row-between mono" style={{ fontSize: 10, padding: "7px 0", letterSpacing: ".08em" }}>
                  <span style={{ color: "var(--gray3)" }}>{k}</span>
                  <span style={{ color: gr ? "var(--green)" : "#fff" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 32 }}>
              <button className="btn-primary" disabled={busy} onClick={finish}>
                {busy ? "ENTERING..." : "ENTER RESONATE →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
