"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  saveBasicInfo,
  saveGenresWithSignal,
  savePhotoUrl,
  removePhotoUrl,
  completeOnboarding,
  getProfileBasics,
} from "./actions";
import { OnboardingLocation } from "@/components/OnboardingLocation";
import { useLocation } from "@/lib/geo/LocationProvider";
import { refreshCityEvents, type ActiveLocation } from "@/lib/geo/types";

// EDM is offered as sub-genres; every other big category stays coarse.
// On save the client rolls any EDM sub-genre up to "ELECTRONIC / EDM" so that
// profile display / events filter / match% (which only know the 12 big
// categories) keep working — see saveGenreStep().
const EDM_SUBGENRES = ["TECHNO", "HOUSE", "TRANCE", "BASS", "DUBSTEP", "FUTURE BASS"];
const OTHER_GENRES = [
  "HIP-HOP / RAP", "POP", "ROCK", "R&B / SOUL", "JAZZ / BLUES",
  "INDIE / ALTERNATIVE", "METAL / PUNK", "COUNTRY / FOLK", "LATIN",
  "REGGAE", "CLASSICAL / ORCHESTRA",
];
const GENRE_OPTIONS = [...EDM_SUBGENRES, ...OTHER_GENRES];
const EDM_BIG = "ELECTRONIC / EDM";

const GENDERS: [string, string][] = [
  ["male", "MALE"],
  ["female", "FEMALE"],
  ["nonbinary", "NON-BINARY"],
  ["undisclosed", "PREFER NOT TO SAY"],
];

const GLOWS = [
  "rgba(57,255,20,.5)", "rgba(150,80,255,.5)", "rgba(60,140,255,.5)",
  "rgba(40,220,220,.5)", "rgba(255,180,40,.5)", "rgba(255,60,60,.5)",
];

const MAX_PHOTOS = 6;
const MIN_PHOTOS = 1;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

type Photo = { id: number; url: string; uploading?: boolean };

// 3-dot step progress header
function ObTop({ filled, tag }: { filled: number; tag: string }) {
  return (
    <div className="ob-progress" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={"ob-dot" + (i < filled ? " on" : "")} />
        ))}
      </div>
      <span className="ob-step-tag">{tag}</span>
    </div>
  );
}

export default function OnboardingPage() {
  // 3 screens: 1 profile · 2 genres · 3 photos
  const [step, setStep] = useState(1);
  const { setLocation } = useLocation();

  // profile
  const [location, setLoc] = useState<ActiveLocation | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState(24);
  const [gender, setGender] = useState("");
  const [ig, setIg] = useState("");

  // genres + photos
  const [genres, setGenres] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoIdRef = useRef(1);
  const photosRef = useRef<Photo[]>([]);
  const [popId, setPopId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  useEffect(() => { photosRef.current = photos; }, [photos]);

  // prefill name from an existing profile (e.g. Google display name)
  useEffect(() => {
    getProfileBasics().then(({ displayName }) => {
      if (displayName) setName(displayName.toUpperCase());
    });
  }, []);

  // ---- photo upload to Supabase Storage ----
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || photos.length >= MAX_PHOTOS) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    for (const file of Array.from(files)) {
      if (photosRef.current.length >= MAX_PHOTOS) break;
      const id = photoIdRef.current++;
      const sortOrder = photosRef.current.length;
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
      await savePhotoUrl(url, sortOrder);
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
  const photoOk = photoCount >= MIN_PHOTOS;
  const canContinueProfile = !!name.trim() && !!gender && !!location;

  // ---- step transitions that persist data ----
  async function saveProfile() {
    if (!canContinueProfile || busy) return;
    setBusy(true);
    try {
      await saveBasicInfo(name, age, gender, ig);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function saveGenreStep() {
    if (genres.length < 1 || busy) return;
    setBusy(true);
    try {
      const rolled = genres.some((g) => EDM_SUBGENRES.includes(g))
        ? [...genres, EDM_BIG]
        : genres;
      await saveGenresWithSignal(rolled);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!photoOk || busy) return;
    setBusy(true);
    try {
      await completeOnboarding(); // redirects to /events
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", marginTop: 8, background: "var(--panel-2)",
    border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "12px",
    color: "#fff", fontSize: 13, outline: "none",
  };

  return (
    <div className="app-frame atmos-scanlines">
      {/* STEP 1 — PROFILE (location + name + age + gender + IG, one screen) */}
      {step === 1 && (
        <div className="ob-screen">
          <ObTop filled={1} tag="STEP 01 / 03" />
          <div className="ob-title">YOUR PROFILE</div>
          <div className="ob-sub">ONE SCREEN. KEEP IT REAL.</div>

          {/* location */}
          <div style={{ marginTop: 22 }}>
            <label className="label-green">LOCATION</label>
            {!location ? (
              <div style={{ marginTop: 10 }}>
                <OnboardingLocation
                  onResolved={(loc) => {
                    setLoc(loc);
                    setLocation(loc);
                    refreshCityEvents(loc);
                  }}
                />
              </div>
            ) : (
              <div className="row-between" style={{ marginTop: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--green)" }}>
                  ✓ {location.display_name.toUpperCase()}
                </span>
                <button className="btn-link" onClick={() => setLoc(null)}>CHANGE</button>
              </div>
            )}
          </div>

          {/* name */}
          <div style={{ marginTop: 22 }}>
            <label className="label-green">NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              maxLength={20}
              placeholder="YOUR NAME"
              className="mono"
              style={inputStyle}
            />
          </div>

          {/* age */}
          <div style={{ marginTop: 22 }}>
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

          {/* gender */}
          <div style={{ marginTop: 22 }}>
            <label className="label-green">GENDER</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
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
          </div>

          {/* IG (optional) */}
          <div style={{ marginTop: 22 }}>
            <label className="label-green">INSTAGRAM (OPTIONAL)</label>
            <input
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              placeholder="@YOURHANDLE"
              className="mono"
              style={inputStyle}
            />
          </div>

          <div style={{ flex: 1, minHeight: 24 }} />
          <button className="btn-primary" disabled={!canContinueProfile || busy} onClick={saveProfile}>
            {busy ? "SAVING..." : "CONTINUE →"}
          </button>
        </div>
      )}

      {/* STEP 2 — GENRES (EDM split into sub-genres, others coarse) */}
      {step === 2 && (
        <div className="ob-screen">
          <ObTop filled={2} tag="STEP 02 / 03" />
          <div className="ob-title">YOUR GENRES</div>
          <div className="ob-sub">PICK UP TO 5 · {genres.length}/5 SELECTED</div>
          <div className="genre-grid">
            {GENRE_OPTIONS.map((g) => {
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
          <button className="btn-primary" disabled={genres.length < 1 || busy} onClick={saveGenreStep}>
            {busy ? "SAVING..." : "CONTINUE →"}
          </button>
        </div>
      )}

      {/* STEP 3 — PHOTOS (original grid UI; min 1, max 6) */}
      {step === 3 && (
        <div className="ob-screen">
          <ObTop filled={3} tag="STEP 03 / 03" />
          <div className="ob-title">ADD YOUR PHOTOS</div>
          <div className="ob-sub">1–6 PHOTOS · AT LEAST ONE CLEAR FACE. LIFESTYLE &amp; SHOW PHOTOS WELCOME.</div>

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
            {photoCount < MAX_PHOTOS && (
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
            {photoOk ? `${photoCount}/${MAX_PHOTOS} ADDED · ✓ READY` : `${photoCount}/${MAX_PHOTOS} ADDED · NEED AT LEAST ${MIN_PHOTOS}`}
          </div>

          <div style={{ flex: 1, minHeight: 16 }} />
          <button className="btn-primary" disabled={!photoOk || busy} onClick={finish}>
            {busy ? "ENTERING..." : "ENTER RESONATE →"}
          </button>
        </div>
      )}
    </div>
  );
}
