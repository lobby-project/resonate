import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { COL_TITLE } from "@/lib/schemaMap";
import { fulfillOrder } from "@/lib/fulfill";

// POST /api/checkout
// body: { eventId, tierId, qty, code?, attendeeName, attendeePhone?, pwywCents? }
// 全部校验在服务端做(库存/售卖窗/限购/折扣码),价格服务端算,前端报价仅展示。
// 免费票($0)不走 Stripe,直接出票。

function svc() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.eventId || !body?.tierId || !body?.qty || !body?.attendeeName) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  const qty = Math.floor(Number(body.qty));
  if (!Number.isFinite(qty) || qty < 1) {
    return NextResponse.json({ error: "数量不合法" }, { status: 400 });
  }

  const db = svc();
  const { data: ev } = await db.from("events").select("*").eq("id", body.eventId).single();
  if (!ev || !ev.is_owned || ev.status !== "published") {
    return NextResponse.json({ error: "活动不存在或未发布" }, { status: 404 });
  }
  if (!ev.sales_open) {
    return NextResponse.json({ error: ev.closed_message || "Sales are closed." }, { status: 400 });
  }
  if (ev.date_tbd) {
    return NextResponse.json({ error: "日期待定的活动暂只开放 RSVP" }, { status: 400 });
  }
  if (qty > (ev.ticket_limit_per_order ?? 8)) {
    return NextResponse.json({ error: `每单最多 ${ev.ticket_limit_per_order ?? 8} 张` }, { status: 400 });
  }

  const { data: tier } = await db
    .from("ticket_types")
    .select("*")
    .eq("id", body.tierId)
    .eq("event_id", body.eventId)
    .eq("is_active", true)
    .single();
  if (!tier) return NextResponse.json({ error: "票档不存在" }, { status: 404 });

  const now = new Date();
  if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) {
    return NextResponse.json({ error: "该票档还未开售" }, { status: 400 });
  }
  if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) {
    return NextResponse.json({ error: "该票档已停售" }, { status: 400 });
  }
  if (tier.quantity_total != null && tier.quantity_sold + qty > tier.quantity_total) {
    return NextResponse.json({ error: ev.soldout_message || "Tickets are sold out." }, { status: 400 });
  }

  // ---- 单价 ----
  let unitCents: number;
  if (tier.pricing_method === "free") {
    unitCents = 0;
  } else if (tier.pricing_method === "pwyw") {
    const offered = Math.floor(Number(body.pwywCents ?? -1));
    const min = tier.min_price_cents ?? 0;
    if (!Number.isFinite(offered) || offered < min) {
      return NextResponse.json({ error: `最低 $${(min / 100).toFixed(2)}` }, { status: 400 });
    }
    unitCents = offered;
  } else {
    if (tier.price_cents == null || tier.price_cents <= 0) {
      return NextResponse.json({ error: "票档价格异常" }, { status: 500 });
    }
    unitCents = tier.price_cents;
  }

  // ---- 折扣码 ----
  let discountCents = 0;
  let discountCodeId: string | null = null;
  const subtotal = unitCents * qty;
  if (body.code) {
    const { data: dc } = await db
      .from("discount_codes")
      .select("*")
      .eq("code", String(body.code).trim().toUpperCase())
      .eq("is_active", true)
      .single();
    const valid =
      dc &&
      (dc.event_id === null || dc.event_id === body.eventId) &&
      (!dc.expires_at || new Date(dc.expires_at) > now) &&
      (dc.max_uses == null || dc.used_count < dc.max_uses);
    if (!valid) return NextResponse.json({ error: "折扣码无效或已用完" }, { status: 400 });
    discountCents = dc.percent_off
      ? Math.round((subtotal * dc.percent_off) / 100)
      : Math.min(dc.amount_off_cents ?? 0, subtotal);
    discountCodeId = dc.id;
  }

  // 隐藏票档(嘉宾票)门禁:必须携带有效折扣码才能下单
  if (tier.is_visible === false && !discountCodeId) {
    return NextResponse.json({ error: "该票档需要邀请码" }, { status: 403 });
  }

  const discounted = subtotal - discountCents;
  const feePercent = Number(ev.fee_percent ?? 0);
  const feeCents = discounted > 0 ? Math.round((discounted * feePercent) / 100) : 0;
  const totalCents = discounted + feeCents;

  // ---- 建订单(pending) ----
  const { data: order, error: ordErr } = await db
    .from("orders")
    .insert({
      user_id: user.id,
      event_id: body.eventId,
      status: "pending",
      subtotal_cents: subtotal,
      discount_cents: discountCents,
      discount_code_id: discountCodeId,
      fee_cents: feeCents,
      fee_name: ev.fee_name ?? "Processing",
      total_cents: totalCents,
      attendee_name: String(body.attendeeName).slice(0, 120),
      attendee_phone: ev.collect_phone ? (body.attendeePhone ?? null) : null,
    })
    .select("id")
    .single();
  if (ordErr || !order) return NextResponse.json({ error: "订单创建失败" }, { status: 500 });

  // ---- $0:不走 Stripe,直接出票 + going ----
  if (totalCents === 0) {
    await fulfillOrder(db, order.id, { tierId: tier.id, eventId: body.eventId, userId: user.id, qty, discountCodeId });
    return NextResponse.json({ free: true, orderId: order.id });
  }

  // ---- Stripe Checkout 会话 ----
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(discounted / qty), // 折扣摊进单价,Stripe 金额=我们记账金额
        product_data: { name: `${ev[COL_TITLE]} — ${tier.name}` },
      },
    },
  ];
  if (feeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: feeCents,
        product_data: { name: `${ev.fee_name ?? "Processing"} (${feePercent}%)` },
      },
    });
  }
  // 摊单价的取整误差补到 fee 行:保证 Stripe 收的总额 == totalCents
  const stripeTotal = Math.round(discounted / qty) * qty + feeCents;
  const diff = totalCents - stripeTotal;
  if (diff !== 0 && lineItems[1]?.price_data) {
    lineItems[1].price_data.unit_amount = feeCents + diff;
  } else if (diff !== 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: "usd", unit_amount: diff, product_data: { name: "Adjustment" } },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    metadata: { order_id: order.id, qty: String(qty), tier_id: tier.id, event_id: body.eventId, user_id: user.id },
    success_url: `${site}/events/${body.eventId}?purchase=success`,
    cancel_url: `${site}/events/${body.eventId}?purchase=cancel`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30分钟,设计里定的"结账锁定"
  });

  await db.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return NextResponse.json({ url: session.url });
}
