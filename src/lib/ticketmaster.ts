// ============================================================
// Ticketmaster Discovery API client
// Fetches LA music events, maps TM genre -> our 12 categories.
// Auth: apikey query param (no OAuth). Rate limit 5000/day, 5/sec.
// ============================================================

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";
const MUSIC_SEGMENT_ID = "KZFzniwnSyZfZ7v7nJ"; // Ticketmaster "Music" segment

// PRIMARY mapping: Ticketmaster top-level Genre ID -> our 12 categories.
// IDs are stable; Music segment has a fixed set of 24 top-level genres.
// 100% reliable — does not depend on guessing from names.
const GENRE_ID_MAP: Record<string, string> = {
  KnvZfZ7vAvv: "Indie / Alternative",   // Alternative
  KnvZfZ7vAve: "Pop",                    // Ballads/Romantic
  KnvZfZ7vAvd: "Jazz / Blues",           // Blues
  KnvZfZ7vAvA: "Pop",                    // Chanson Francaise
  KnvZfZ7vAvk: "Pop",                    // Children's Music
  KnvZfZ7vAeJ: "Classical / Orchestra",  // Classical
  KnvZfZ7vAv6: "Country / Folk",         // Country
  KnvZfZ7vAvF: "Electronic / EDM",       // Dance/Electronic
  KnvZfZ7vAva: "Country / Folk",         // Folk
  KnvZfZ7vAv1: "Hip-Hop / Rap",          // Hip-Hop/Rap
  KnvZfZ7vAvJ: "Pop",                    // Holiday
  KnvZfZ7vAvE: "Jazz / Blues",           // Jazz
  KnvZfZ7vAJ6: "Latin",                  // Latin
  KnvZfZ7vAvI: "Classical / Orchestra",  // Medieval/Renaissance
  KnvZfZ7vAvt: "Metal / Punk",           // Metal
  KnvZfZ7vAvn: "Classical / Orchestra",  // New Age
  KnvZfZ7vAvl: "Pop",                    // Other
  KnvZfZ7vAev: "Pop",                    // Pop
  KnvZfZ7vAee: "R&B / Soul",             // R&B
  KnvZfZ7vAed: "Reggae",                 // Reggae
  KnvZfZ7vAe7: "Pop",                    // Religious
  KnvZfZ7vAeA: "Rock",                   // Rock
  // KnvZfZ7vAe6 Undefined -> handled via subGenre fallback
  KnvZfZ7vAeF: "Latin",                  // World (default Latin; refined by subGenre below)
};

// World genre is huge & mixed. Refine by subGenre keywords when the
// top genre is "World" so non-Latin world music lands sensibly.
function refineWorld(subGenreName?: string): string {
  const s = (subGenreName ?? "").toLowerCase();
  const has = (...k: string[]) => k.some((x) => s.includes(x));
  if (has("reggae", "soca", "dancehall", "ska", "calypso", "dub")) return "Reggae";
  if (has("jazz")) return "Jazz / Blues";
  if (has("folk", "celtic", "klezmer")) return "Country / Folk";
  if (has("rock")) return "Rock";
  // salsa/cumbia/bachata/merengue/mariachi/tango/flamenco/brazil... -> Latin
  return "Latin";
}

// FALLBACK mapping by name keywords (for unknown genre, or subGenre when genre is Undefined).
export function mapTmGenre(name?: string): string {
  const g = (name ?? "").toLowerCase();
  const has = (...k: string[]) => k.some((x) => g.includes(x));
  if (has("dance", "electronic", "edm", "house", "techno", "trance", "dubstep", "drum", "garage", "ambient", "downtempo")) return "Electronic / EDM";
  if (has("hip-hop", "hip hop", "rap", "drill", "grime", "reggaeton")) return "Hip-Hop / Rap";
  if (has("r&b", "soul", "funk", "motown")) return "R&B / Soul";
  if (has("jazz", "blues", "swing", "bebop")) return "Jazz / Blues";
  if (has("metal", "punk", "hardcore", "emo", "screamo")) return "Metal / Punk";
  if (has("alternative", "indie", "shoegaze")) return "Indie / Alternative";
  if (has("country", "folk", "bluegrass", "americana")) return "Country / Folk";
  if (has("latin", "salsa", "cumbia", "bachata", "merengue", "mariachi", "banda", "tango", "flamenco")) return "Latin";
  if (has("reggae", "dancehall", "ska", "soca", "calypso", "dub")) return "Reggae";
  if (has("classical", "opera", "orchestra", "baroque", "choral")) return "Classical / Orchestra";
  if (has("rock")) return "Rock";
  if (has("pop", "k-pop")) return "Pop";
  return "Pop"; // last-resort fallback
}

export type TmEvent = {
  tm_id: string;
  artist: string;
  venue: string | null;
  event_date: string | null; // YYYY-MM-DD
  event_time: string | null; // display
  starts_at: string | null;  // ISO
  price_min: number | null;
  price_max: number | null;
  genre: string;             // mapped to our 12
  cover_url: string | null;
  description: string | null;
  ticket_url: string | null;
};

type TmApiEvent = {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: { url: string; width: number; ratio?: string }[];
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string } };
  priceRanges?: { min?: number; max?: number }[];
  classifications?: {
    genre?: { id?: string; name?: string };
    subGenre?: { id?: string; name?: string };
    segment?: { id?: string; name?: string };
  }[];
  _embedded?: { venues?: { name?: string }[] };
};

// Extract our 12-category genre using a 3-layer defense:
// 1. PRIMARY: top-level Genre ID -> our category (100% reliable, 24 fixed genres)
// 2. World genre refined by subGenre keywords
// 3. FALLBACK: genre/subGenre name keywords; logs unmapped so we can extend.
function extractGenre(cls?: TmApiEvent["classifications"]): string {
  const c = cls?.[0];
  const genreId = c?.genre?.id;
  const genreName = c?.genre?.name;
  const subName = c?.subGenre?.name;
  const bad = (s?: string) => !s || /undefined|other|^n\/a$/i.test(s);

  // World → refine by subGenre
  if (genreId === "KnvZfZ7vAeF") return refineWorld(subName);

  // primary: exact ID map
  if (genreId && GENRE_ID_MAP[genreId]) return GENRE_ID_MAP[genreId];

  // genre is Undefined/Other or unknown ID → try names
  if (!bad(genreName)) return mapTmGenre(genreName);
  if (!bad(subName)) return mapTmGenre(subName);

  // nothing usable — log so we can extend the table, don't silently mislabel
  if (genreId || genreName) {
    console.warn(`[ticketmaster] unmapped genre: id=${genreId} name=${genreName} sub=${subName}`);
  }
  return "Pop";
}

// pick a good cover: prefer 16:9 around 600-1200px (cards), else widest 16:9, else widest.
function pickImage(images?: { url: string; width: number; ratio?: string }[]): string | null {
  if (!images?.length) return null;
  const sixteen = images.filter((i) => i.ratio === "16_9").sort((a, b) => a.width - b.width);
  const mid = sixteen.find((i) => i.width >= 600 && i.width <= 1200);
  if (mid) return mid.url;
  if (sixteen.length) return sixteen[sixteen.length - 1].url;
  return [...images].sort((a, b) => b.width - a.width)[0].url;
}

// Fetch LA music events for the next N days
export async function fetchLaMusicEvents(opts?: {
  size?: number;
  daysAhead?: number;
}): Promise<TmEvent[]> {
  const apikey = process.env.TICKETMASTER_API_KEY;
  if (!apikey) throw new Error("TICKETMASTER_API_KEY missing");

  const size = opts?.size ?? 100;
  const daysAhead = opts?.daysAhead ?? 60;
  const startISO = new Date().toISOString().slice(0, 19) + "Z";
  const endISO =
    new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 19) + "Z";

  const params = new URLSearchParams({
    apikey,
    segmentId: MUSIC_SEGMENT_ID,
    city: "Los Angeles",
    sort: "date,asc",
    size: String(size),
    startDateTime: startISO,
    endDateTime: endISO,
  });

  const res = await fetch(`${TM_BASE}/events.json?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ticketmaster ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { _embedded?: { events?: TmApiEvent[] } };
  const events = json._embedded?.events ?? [];

  return events.map((e): TmEvent => {
    const price = e.priceRanges?.[0];
    const localTime = e.dates?.start?.localTime;
    return {
      tm_id: e.id,
      artist: e.name,
      venue: e._embedded?.venues?.[0]?.name ?? null,
      event_date: e.dates?.start?.localDate ?? null,
      event_time: localTime ? formatTime(localTime) : null,
      starts_at: e.dates?.start?.dateTime ?? null,
      price_min: price?.min ?? null,
      price_max: price?.max ?? null,
      genre: extractGenre(e.classifications),
      cover_url: pickImage(e.images),
      description: e.info ?? e.pleaseNote ?? null,
      ticket_url: e.url ?? null,
    };
  });
}

// "22:00:00" -> "10PM"
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")}${ampm}` : `${h}${ampm}`;
}
