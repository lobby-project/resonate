import type { Metadata } from "next";
import InfoLanding from "./InfoLanding";
import "./info.css";

// Public marketing landing, pixel-ported from resonate_info_draft_v3.html.
// Lives in the (marketing) route group on purpose: no app-frame, no
// BottomNav, full-width page (root layout only provides fonts + body).
// Auth-exempt in src/lib/supabase/middleware.ts (isPublic).
export const metadata: Metadata = {
  title: "resonate — the social layer for live music",
  description:
    "resonate is the social layer for live music — discover shows that match your taste, and meet the people who'll be in the same crowd.",
};

export default function InfoPage() {
  return <InfoLanding />;
}
