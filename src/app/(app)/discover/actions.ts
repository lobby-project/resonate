"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export type Candidate = {
  id: string;
  name: string;
  age: number | null;
  signal: string | null;
  photo: string | null;
};

export type GoingEvent = { id: string; artist: string; genre: string | null; cover_url?: string | null };

// service-role client (server-only) for mutual-match detection,
// which must read the OTHER user's swipe (blocked by RLS for normal users).
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Candidates = other attendees of this event, excluding me and anyone I've already swiped.
export async function getCandidates(eventId: string): Promise<Candidate[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // attendees of this event (excluding me)
  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", eventId)
    .neq("user_id", user.id);

  const candidateIds = (attendees ?? []).map((a) => a.user_id);
  if (!candidateIds.length) return [];

  // who I've already swiped on for this event
  const { data: swiped } = await supabase
    .from("swipes")
    .select("target_id")
    .eq("event_id", eventId)
    .eq("swiper_id", user.id);
  const swipedSet = new Set((swiped ?? []).map((s) => s.target_id));

  const remaining = candidateIds.filter((id) => !swipedSet.has(id));
  if (!remaining.length) return [];

  // profiles
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name, age, music_signal")
    .in("id", remaining);

  // first photo each
  const { data: photos } = await supabase
    .from("user_photos")
    .select("user_id, url, sort_order")
    .in("user_id", remaining)
    .order("sort_order", { ascending: true });
  const photoByUser = new Map<string, string>();
  for (const p of photos ?? []) {
    if (!photoByUser.has(p.user_id)) photoByUser.set(p.user_id, p.url);
  }

  return (users ?? []).map((u) => ({
    id: u.id,
    name: u.display_name || "SOMEONE",
    age: u.age,
    signal: u.music_signal,
    photo: photoByUser.get(u.id) ?? null,
  }));
}

export type SwipeResult =
  | { matched: false }
  | { matched: true; matchId: string; otherName: string; otherPhoto: string | null };

// Record a swipe; if it's a resonate and the target already resonated me,
// create a match (canonical user_a < user_b) and return match info.
export async function swipe(
  targetId: string,
  eventId: string,
  direction: "resonate" | "pass"
): Promise<SwipeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (targetId === user.id) throw new Error("Cannot swipe yourself");

  // record my swipe (RLS: swiper must be me)
  await supabase.from("swipes").upsert(
    { swiper_id: user.id, target_id: targetId, event_id: eventId, direction },
    { onConflict: "swiper_id,target_id,event_id" }
  );

  if (direction !== "resonate") return { matched: false };

  // mutual check via service role (can read the target's swipe)
  const a = admin();
  const { data: theirs } = await a
    .from("swipes")
    .select("direction")
    .eq("swiper_id", targetId)
    .eq("target_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!theirs || theirs.direction !== "resonate") return { matched: false };

  // mutual! create match with canonical ordering
  const [ua, ub] = user.id < targetId ? [user.id, targetId] : [targetId, user.id];
  await a
    .from("matches")
    .upsert(
      { user_a: ua, user_b: ub, event_id: eventId },
      { onConflict: "user_a,user_b,event_id" }
    );

  const { data: match } = await a
    .from("matches")
    .select("id")
    .eq("user_a", ua)
    .eq("user_b", ub)
    .eq("event_id", eventId)
    .single();

  // other user's name + photo for the modal
  const { data: other } = await a
    .from("users")
    .select("display_name")
    .eq("id", targetId)
    .single();
  const { data: ophotos } = await a
    .from("user_photos")
    .select("url, sort_order")
    .eq("user_id", targetId)
    .order("sort_order", { ascending: true })
    .limit(1);

  return {
    matched: true,
    matchId: match!.id,
    otherName: other?.display_name || "SOMEONE",
    otherPhoto: ophotos?.[0]?.url ?? null,
  };
}
