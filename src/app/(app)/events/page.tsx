import { createClient } from "@/lib/supabase/server";
import EventsFeed, { type FeedEvent } from "./EventsFeed";

// Server Component: fetch events + going data, pass to client feed.
export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // upcoming events ordered by date
  const { data: events } = await supabase
    .from("events")
    .select("id, artist, venue, event_date, event_time, price_min, genre, cover_url")
    .order("event_date", { ascending: true })
    .limit(100);

  // going counts per event
  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("event_id, user_id");

  const goingCount: Record<string, number> = {};
  const myGoing = new Set<string>();
  for (const a of attendees ?? []) {
    goingCount[a.event_id] = (goingCount[a.event_id] ?? 0) + 1;
    if (user && a.user_id === user.id) myGoing.add(a.event_id);
  }

  const feed: FeedEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    artist: e.artist,
    venue: e.venue,
    event_date: e.event_date,
    event_time: e.event_time,
    price_min: e.price_min,
    genre: e.genre,
    cover_url: e.cover_url,
    going_count: goingCount[e.id] ?? 0,
    is_going: myGoing.has(e.id),
    match: 0, // TODO: compute from music signal vs event genre
  }));

  return <EventsFeed events={feed} />;
}
