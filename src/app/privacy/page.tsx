import type { Metadata } from "next";
import Link from "next/link";

// Placeholder Privacy Policy — required for App Store submission.
// Public route (auth-exempt in src/lib/supabase/middleware.ts).
export const metadata: Metadata = {
  title: "Privacy Policy — Resonate",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 120px" }}>
      <Link href="/info" className="mono" style={{ fontSize: 10, letterSpacing: ".2em", color: "var(--green)", textDecoration: "none" }}>
        ← RESONATE
      </Link>
      <h1 className="dot" style={{ fontSize: 44, margin: "28px 0 8px" }}>
        privacy policy
      </h1>
      <p className="mono" style={{ fontSize: 10, letterSpacing: ".14em", color: "var(--gray3)", textTransform: "uppercase" }}>
        Last updated: July 2026
      </p>
      <p className="mono" style={{ fontSize: 13, lineHeight: 1.8, color: "var(--gray-2)", marginTop: 32 }}>
        Full policy is being finalized. Resonate stores only what the product
        needs — your account, taste signal, and activity inside the app — and
        never sells personal data. For questions or deletion requests, contact{" "}
        <a href="mailto:chris@resonateapp.live" style={{ color: "var(--green)" }}>
          chris@resonateapp.live
        </a>
        .
      </p>
    </main>
  );
}
