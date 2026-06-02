import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchLaMusicEvents } from "@/lib/ticketmaster";

// Sync LA music events from Ticketmaster into the events table.
// Uses the SERVICE ROLE key (server-only) to bypass RLS for writes.
// Trigger manually: GET /api/sync-events?secret=YOUR_SECRET
// (later: hook to a Vercel Cron)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // simple guard so randoms can't trigger your sync
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const events = await fetchLaMusicEvents({ size: 100, daysAhead: 60 });

    // service-role client (bypasses RLS; server-only, never expose this key)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // upsert by tm_id (dedup on single source)
    const rows = events.map((e) => ({
      tm_id: e.tm_id,
      artist: e.artist,
      venue: e.venue,
      event_date: e.event_date,
      event_time: e.event_time,
      starts_at: e.starts_at,
      price_min: e.price_min,
      price_max: e.price_max,
      genre: e.genre,
      cover_url: e.cover_url,
      description: e.description,
      ticket_url: e.ticket_url,
    }));

    const { error, count } = await admin
      .from("events")
      .upsert(rows, { onConflict: "tm_id", count: "exact" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      fetched: events.length,
      upserted: count ?? rows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
