"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Spotify entry temporarily hidden (dev-mode 5-user wall). OAuth/callback/onboarding
// Spotify path are all left intact — flip this back to `true` to restore the button.
const SHOW_SPOTIFY = false;

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // On mount: if an OAuth code landed here, forward it to the callback.
  // If a session already exists (e.g. OAuth bounced back to /login),
  // route the user straight in instead of making them click again.
  useEffect(() => {
    const supabase = createClient();

    // 1. stray ?code= on /login → hand off to the real callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      router.replace(`/auth/callback?code=${code}`);
      return;
    }

    // 2. already signed in → route by onboarded status
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("onboarded")
          .eq("id", user.id)
          .maybeSingle();
        router.replace(profile?.onboarded ? "/events" : "/onboarding");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  async function signInWithSpotify() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        scopes: "user-top-read user-read-email",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) console.error("Spotify sign-in error:", error.message);
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) console.error("Google sign-in error:", error.message);
  }

  // brief loading state while we check for an existing session,
  // so we don't flash the login buttons during an OAuth bounce
  if (checking) {
    return (
      <div className="app-frame atmos-scanlines">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: ".15em", color: "var(--gray)" }}>
            ● CONNECTING...
          </span>
        </div>
      </div>
    );
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
          {SHOW_SPOTIFY && (
            <>
              <button className="btn-spotify" onClick={signInWithSpotify}>
                <span>♫</span> CONTINUE WITH SPOTIFY
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span className="mono" style={{ fontSize: 9, letterSpacing: ".14em", color: "var(--gray3)" }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
            </>
          )}

          <button
            className="btn-primary"
            onClick={signInWithGoogle}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", fontSize: 14, padding: "18px" }}
          >
            <span style={{ fontWeight: 700 }}>G</span> CONTINUE WITH GOOGLE
          </button>

          <p className="ob-foot-note">
            PICK YOUR GENRES · WE&apos;LL BUILD YOUR MUSIC SIGNAL
          </p>
          <p className="ob-foot-note" style={{ marginTop: 4 }}>LA ONLY · BETA ACCESS</p>
        </div>
      </div>
    </div>
  );
}
