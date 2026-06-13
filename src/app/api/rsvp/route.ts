import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// POST /api/rsvp { eventId } — RSVP 活动:容量校验 + going(进 swipe 池)
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { eventId } = await req.json().catch(() => ({}));
  if (!eventId) return NextResponse.json({ error: "参数不完整" }, { status: 400 });

  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: ev } = await db
    .from("events")
    .select("id, is_owned, status, event_type, sales_open, rsvp_capacity, closed_message")
    .eq("id", eventId)
    .single();
  if (!ev || !ev.is_owned || ev.status !== "published" || ev.event_type !== "rsvp") {
    return NextResponse.json({ error: "活动不存在或不接受 RSVP" }, { status: 404 });
  }
  if (!ev.sales_open) {
    return NextResponse.json({ error: ev.closed_message || "RSVP is closed." }, { status: 400 });
  }

  const { data: existing } = await db
    .from("event_attendees")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true });

  if (ev.rsvp_capacity != null) {
    const { count } = await db
      .from("event_attendees")
      .select("event_id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) >= ev.rsvp_capacity) {
      return NextResponse.json({ error: "RSVP 名额已满" }, { status: 400 });
    }
  }

  await db.from("event_attendees").insert({ event_id: eventId, user_id: user.id });
  return NextResponse.json({ ok: true });
}
