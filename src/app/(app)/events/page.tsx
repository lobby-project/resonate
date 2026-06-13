import { createClient } from "@/lib/supabase/server";
import EventsFeed, { type FeedEvent } from "./EventsFeed";
import RSelectedShelf from "@/components/ticketing/RSelectedShelf";

// Server Component: fetch events + going data, pass to client feed.
export default async function EventsPage() {
  const supabase = await createClient();

  // Fetch a broad set; the client EventsFeed filters in-memory by Haversine
  // distance to the active location (LocationContext). Limit is wide enough
  // to cover a multi-city DB; client-side geo filter then narrows by radius.
  // 过期过滤：只取 event_date >= 今天(LA) 的演出。event_date 是演出当地日期；
  // beta 阶段统一按 LA 当天比较（en-CA 给 YYYY-MM-DD 格式，可直接和 date 列比）。
  const todayLA = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  // getSession reads the cookie locally (no GoTrue roundtrip). proxy.ts ran
  // getUser() and refreshed the cookie before this handler — so the session
  // here is already validated for this request.
  const [{ data: { session } }, { data: events }] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from("events")
      .select("id, artist, venue, event_date, event_time, price_min, genre, cover_url, city, lat, lng, is_owned")
      .gte("event_date", todayLA)
      .order("event_date", { ascending: true })
      .limit(500),
  ]);
  const user = session?.user ?? null;

  // Scope attendee queries to the visible event IDs (was: full-table SELECT).
  // Counts come from one cheap query; the user's own going set from another.
  const eventIds = (events ?? []).map((e) => e.id);
  const [attendeesRes, mineRes] = await Promise.all([
    eventIds.length
      ? supabase.from("event_attendees").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    user && eventIds.length
      ? supabase
          .from("event_attendees")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
  ]);

  const goingCount: Record<string, number> = {};
  for (const a of attendeesRes.data ?? []) {
    goingCount[a.event_id] = (goingCount[a.event_id] ?? 0) + 1;
  }
  const myGoing = new Set<string>((mineRes.data ?? []).map((a) => a.event_id));

  const feed = (events ?? []).map((e): FeedEvent & { is_owned: boolean } => ({
    id: e.id,
    artist: e.artist,
    venue: e.venue,
    event_date: e.event_date,
    event_time: e.event_time,
    price_min: e.price_min,
    genre: e.genre,
    cover_url: e.cover_url,
    city: e.city,
    lat: e.lat,
    lng: e.lng,
    going_count: goingCount[e.id] ?? 0,
    is_going: myGoing.has(e.id),
    match: 0, // TODO: compute from music signal vs event genre
    is_owned: !!e.is_owned,
  }));

  return <EventsFeed events={feed} shelf={<RSelectedShelf />} />;
}
