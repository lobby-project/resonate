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

  // email OTP — user types the 6-digit code from the email (no magic link)
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false); // switched to the code-entry view
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

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

  // 1) send the 6-digit code. No emailRedirectTo → Supabase emails an OTP code
  //    instead of a magic link, and we collect it on the next view.
  async function signInWithEmail() {
    const addr = email.trim();
    if (!addr || sending) return;
    setSending(true);
    setOtpError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: addr });
    setSending(false);
    if (error) {
      console.error("Email sign-in error:", error.message);
      setOtpError(error.message);
      return;
    }
    setCodeSent(true);
  }

  // 2) verify the typed code. On success the browser session is set, so we route
  //    by onboarded status ourselves (this path never goes through /auth/callback).
  async function verifyEmailCode() {
    const token = code.trim();
    if (token.length < 6 || verifying) return;
    setVerifying(true);
    setOtpError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (error) {
      setVerifying(false);
      setOtpError(error.message);
      return;
    }
    const user = data.user;
    if (!user) {
      setVerifying(false);
      setOtpError("Verification failed. Try again.");
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle();
    router.replace(profile?.onboarded ? "/events" : "/onboarding");
  }

  // phone login: entry placeholder only — SMS provider not wired yet
  function phoneComingSoon() {
    alert("PHONE LOGIN COMING SOON");
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span className="mono" style={{ fontSize: 9, letterSpacing: ".14em", color: "var(--gray3)" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {codeSent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: ".1em", color: "var(--gray)", textAlign: "center" }}>
                ENTER THE 6-DIGIT CODE SENT TO {email.trim().toUpperCase()}
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") verifyEmailCode(); }}
                placeholder="000000"
                className="mono"
                autoFocus
                style={{ width: "100%", background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 6, padding: "13px", color: "#fff", fontSize: 18, letterSpacing: ".5em", textAlign: "center", outline: "none" }}
              />
              <button
                className="btn-out"
                onClick={verifyEmailCode}
                disabled={code.length < 6 || verifying}
                style={{ opacity: code.length < 6 || verifying ? 0.5 : 1 }}
              >
                {verifying ? "VERIFYING..." : "VERIFY & CONTINUE"}
              </button>
              <button
                className="btn-link"
                onClick={() => { setCodeSent(false); setCode(""); setOtpError(null); }}
                style={{ alignSelf: "center", marginTop: 2 }}
              >
                ← USE A DIFFERENT EMAIL
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") signInWithEmail(); }}
                placeholder="YOU@EMAIL.COM"
                className="mono"
                style={{ width: "100%", background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 6, padding: "13px", color: "#fff", fontSize: 12, letterSpacing: ".06em", outline: "none", textTransform: "uppercase" }}
              />
              <button
                className="btn-out"
                onClick={signInWithEmail}
                disabled={!email.trim() || sending}
                style={{ opacity: !email.trim() || sending ? 0.5 : 1 }}
              >
                {sending ? "SENDING..." : "CONTINUE WITH EMAIL"}
              </button>
            </div>
          )}

          {otpError && (
            <p className="mono" style={{ marginTop: 8, fontSize: 9, letterSpacing: ".08em", color: "#ff6060", textAlign: "center" }}>
              {otpError.toUpperCase()}
            </p>
          )}

          <button
            className="btn-out"
            onClick={phoneComingSoon}
            style={{ marginTop: 8, color: "var(--gray)", borderColor: "var(--border)" }}
          >
            CONTINUE WITH PHONE
          </button>

          <p className="ob-foot-note" style={{ marginTop: 16 }}>
            PICK YOUR GENRES · WE&apos;LL BUILD YOUR MUSIC SIGNAL
          </p>
          <p className="ob-foot-note" style={{ marginTop: 4 }}>LA ONLY · BETA ACCESS</p>
        </div>
      </div>
    </div>
  );
}
