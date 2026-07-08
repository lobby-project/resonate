import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InfoLanding from "@/app/(marketing)/info/InfoLanding";
import "@/app/(marketing)/info/info.css";

// Root route.
// 1. SAFETY NET: if an OAuth code lands here (Supabase Site URL fallback when
//    redirectTo didn't match the allowlist), forward it to the real callback
//    so the session can still be established instead of being silently dropped.
// 2. Otherwise route by auth state:
//    - logged out → render the marketing landing (server-side, no flash)
//    - logged in  → /events (onboarded) or /onboarding
// The landing renders outside the (app) route group, so no app-frame/BottomNav.
export const metadata: Metadata = {
  title: "resonate — the social layer for live music",
  description:
    "resonate is the social layer for live music — discover shows that match your taste, and meet the people who'll be in the same crowd.",
};

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (params.code) {
    redirect(`/auth/callback?code=${params.code}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <InfoLanding />;

  const { data: profile } = await supabase
    .from("users")
    .select("onboarded")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile?.onboarded ? "/events" : "/onboarding");
}
