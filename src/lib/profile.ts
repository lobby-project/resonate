import { createClient } from "@/lib/supabase/server";

export type ProfileShow = {
  id: string;
  artist: string;
  venue: string | null;
  event_date: string | null;
  event_time: string | null;
  cover_url: string | null;
  hasTicket: boolean;
};

export type FullProfile = {
  userId: string;
  name: string;
  age: number | null;
  signal: string | null;
  genres: string[];
  photos: string[];
  isSpotify: boolean;
  gender: string | null;
  igHandle: string | null;
  bio: string | null;
  upcoming: ProfileShow[];
  past: ProfileShow[];
};

// Read a full profile for any user (self or someone else). Returns null if the
// user row doesn't exist. Shared by /profile and /profile/[id].
export async function getProfileData(userId: string): Promise<FullProfile | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, age, music_signal, spotify_id, gender, ig_handle, bio")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: music } = await supabase
    .from("user_music_data")
    .select("genres")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: photoRows } = await supabase
    .from("user_photos")
    .select("url, sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  // going / attended shows → split past vs upcoming by event_date (LA local).
  const { data: att } = await supabase
    .from("event_attendees")
    .select("event_id")
    .eq("user_id", userId);
  const eventIds = [...new Set((att ?? []).map((a) => a.event_id))];

  let upcoming: ProfileShow[] = [];
  let past: ProfileShow[] = [];

  if (eventIds.length) {
    const { data: events } = await supabase
      .from("events")
      .select("id, artist, venue, event_date, event_time, cover_url")
      .in("id", eventIds);

    // ticket badge — orders RLS may hide other users' rows; that's fine (no badge).
    const { data: paid } = await supabase
      .from("orders")
      .select("event_id")
      .eq("user_id", userId)
      .eq("status", "paid");
    const ticketed = new Set((paid ?? []).map((o) => o.event_id));

    const todayLA = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });

    const shows: ProfileShow[] = (events ?? []).map((e) => ({
      id: e.id,
      artist: e.artist,
      venue: e.venue,
      event_date: e.event_date,
      event_time: e.event_time,
      cover_url: e.cover_url,
      hasTicket: ticketed.has(e.id),
    }));

    upcoming = shows
      .filter((s) => s.event_date && s.event_date >= todayLA)
      .sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1));
    past = shows
      .filter((s) => !s.event_date || s.event_date < todayLA)
      .sort((a, b) => (a.event_date! > b.event_date! ? -1 : 1));
  }

  return {
    userId,
    name: profile.display_name ?? "",
    age: profile.age ?? null,
    signal: profile.music_signal ?? null,
    genres: (music?.genres as string[] | null) ?? [],
    photos: (photoRows ?? []).map((p) => p.url),
    isSpotify: !!profile.spotify_id,
    gender: profile.gender ?? null,
    igHandle: profile.ig_handle ?? null,
    bio: profile.bio ?? null,
    upcoming,
    past,
  };
}
