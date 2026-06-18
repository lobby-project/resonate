import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EventDetail, { type DetailEvent, type EventChatData } from "./EventDetail";
import { type EventMsg } from "@/app/(app)/chat/event/[id]/EventChat";

// Compute a match % from the user's chosen genres vs the event genre.
// Case-insensitive (onboarding stores UPPER, events store Title Case).
// Deterministic per event so it doesn't jump around between renders.
function computeMatch(eventGenre: string | null, userGenres: string[], seed: string): number {
  const eg = (eventGenre ?? "").trim().toLowerCase();
  const set = new Set(userGenres.map((g) => g.trim().toLowerCase()));
  const hit = eg && set.has(eg);
  // deterministic jitter from event id
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const jitter = h % 12; // 0-11
  return hit ? 88 + (h % 12) : 52 + jitter; // match: 88-99, else 52-63
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // getSession reads the cookie locally (no GoTrue roundtrip). proxy.ts ran
  // getUser() and refreshed the cookie before this handler — so the session
  // here is already validated for this request.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Four independent queries in parallel (was: sequential await chain).
  const [eventRes, goingCountRes, mineRes, musicRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, artist, venue, event_date, event_time, price_min, price_max, genre, cover_url, description, ticket_url, is_owned, poster_url")
      .eq("id", id)
      .single(),
    supabase
      .from("event_attendees")
      .select("*", { count: "exact", head: true })
      .eq("event_id", id),
    user
      ? supabase
          .from("event_attendees")
          .select("event_id, anon_num")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : null,
    user
      ? supabase
          .from("user_music_data")
          .select("genres")
          .eq("user_id", user.id)
          .maybeSingle()
      : null,
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const userGenres = ((musicRes?.data?.genres as string[] | null) ?? []);

  const isGoing = !!mineRes?.data;

  const detail: DetailEvent = {
    ...event,
    going_count: goingCountRes.count ?? 0,
    is_going: isGoing,
    match: computeMatch(event.genre, userGenres, event.id),
  };

  // Chat tab is only unlocked when going, so only load its data then. Mirrors
  // chat/event/[id]/page.tsx (anon_num from event_attendees, last 200 msgs).
  let chat: EventChatData | null = null;
  if (isGoing && user) {
    const { data: msgs } = await supabase
      .from("event_messages")
      .select("id, anon_num, text, user_id, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    chat = {
      myUserId: user.id,
      myAnonNum: (mineRes!.data as { anon_num: number | null }).anon_num ?? 0,
      initialMessages: (msgs ?? []) as EventMsg[],
    };
  }

  return <EventDetail event={detail} chat={chat} />;
}
