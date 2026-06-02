"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signInWithSpotify() {
    console.log("[LOGIN] clicked");
    console.log("[LOGIN] url present:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[LOGIN] key present:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        scopes: "user-top-read user-read-email",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    console.log("[LOGIN] result:", JSON.stringify({ data, error }));
    if (error) console.error("[LOGIN] err:", error.message);
  }

  return (
    <div className="app-frame atmos-scanlines">
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 24px 40px",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="ld-kicker">
            <span>●</span> LA · BETA ACCESS
          </div>
          <h1 className="ld-word" style={{ marginTop: 16 }}>
            RESONATE
          </h1>
          <p className="ld-tag">FIND SHOWS. MEET YOUR PEOPLE.</p>
          <p className="ld-desc">
            MUSIC-ANCHORED SOCIAL FOR
            <br />
            LA&apos;S LIVE MUSIC SCENE.
          </p>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["🎧", "MATCH BY MUSIC TASTE"],
              ["🎫", "CONNECT AT SHOWS"],
              ["💬", "VIBE WITH YOUR PEOPLE"],
            ].map(([icon, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span className="mono caps" style={{ fontSize: 11, color: "#fff" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <button className="btn-spotify" onClick={signInWithSpotify}>
            <span>♫</span> CONTINUE WITH SPOTIFY
          </button>
          <p className="ob-foot-note">LA ONLY · BETA ACCESS</p>
        </div>
      </div>
    </div>
  );
}
