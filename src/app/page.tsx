import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Root route. Replaces the create-next-app default template.
// 1. SAFETY NET: if an OAuth code lands here (Supabase Site URL fallback when
//    redirectTo didn't match the allowlist), forward it to the real callback
//    so the session can still be established instead of being silently dropped.
// 2. Otherwise route by auth state.
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

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("onboarded")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile?.onboarded ? "/events" : "/onboarding");
}
