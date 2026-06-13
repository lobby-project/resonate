import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// GET /api/event/[id]/ticketing — 购票面板的全部数据(票档+费率+限购+文案)
// 只返回 is_visible 的票档;隐藏票档不陈列(将来配合折扣码解锁,T3)。
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const codeParam = new URL(req.url).searchParams.get("code")?.trim().toUpperCase() || null;
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: ev } = await db
    .from("events")
    .select(
      "id, is_owned, status, event_type, date_tbd, sales_open, fee_name, fee_percent, ticket_limit_per_order, collect_phone, soldout_message, closed_message, refund_policy, rsvp_capacity, poster_url"
    )
    .eq("id", id)
    .single();
  if (!ev || !ev.is_owned || ev.status !== "published") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 折扣码有效性(也用于解锁隐藏票档=嘉宾票机制)
  let codeValid = false;
  if (codeParam) {
    const { data: dc } = await db
      .from("discount_codes")
      .select("event_id, expires_at, max_uses, used_count")
      .eq("code", codeParam)
      .eq("is_active", true)
      .single();
    codeValid = !!(
      dc &&
      (dc.event_id === null || dc.event_id === id) &&
      (!dc.expires_at || new Date(dc.expires_at) > new Date()) &&
      (dc.max_uses == null || dc.used_count < dc.max_uses)
    );
  }

  const now = new Date().toISOString();
  let q = db
    .from("ticket_types")
    .select(
      "id, name, description, pricing_method, price_cents, min_price_cents, quantity_total, quantity_sold, sale_starts_at, sale_ends_at, is_visible"
    )
    .eq("event_id", id)
    .eq("is_active", true);
  if (!codeValid) q = q.eq("is_visible", true); // 有效码才连隐藏档一起返回
  const { data: tiers } = await q.order("sort_order", { ascending: true });

  const shaped = (tiers ?? []).map((t) => ({
    ...t,
    unlocked: t.is_visible === false, // 前端打 UNLOCKED 角标用
    sold_out: t.quantity_total != null && t.quantity_sold >= t.quantity_total,
    not_started: !!(t.sale_starts_at && t.sale_starts_at > now),
    ended: !!(t.sale_ends_at && t.sale_ends_at < now),
  }));

  return NextResponse.json({ event: ev, tiers: shaped, code_valid: codeParam ? codeValid : null });
}
