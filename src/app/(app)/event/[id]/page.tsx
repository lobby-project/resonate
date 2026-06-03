import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EventDetail, { type DetailEvent } from "./EventDetail";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("id, artist, venue, event_date, event_time, price_min, price_max, genre, cover_url, description, ticket_url")
    .eq("id", id)
    .single();

  if (!event) notFound();

  // going count
  const { count: goingCount } = await supabase
    .from("event_attendees")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id);

  // am I going?
  let isGoing = false;
  let userGenres: string[] = [];
  if (user) {
    const { data: mine } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    isGoing = !!mine;

    const { data: music } = await supabase
      .from("user_music_data")
      .select("genres")
      .eq("user_id", user.id)
      .maybeSingle();
    userGenres = (music?.genres as string[] | null) ?? [];
  }

  const detail: DetailEvent = {
    ...event,
    going_count: goingCount ?? 0,
    is_going: isGoing,
    match: computeMatch(event.genre, userGenres, event.id),
  };

  return <EventDetail event={detail} />;
}
