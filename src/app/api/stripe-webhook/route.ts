import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { fulfillOrder } from "@/lib/fulfill";

// Stripe webhook:支付完成 → 出票;会话过期 → 释放订单。
// 签名校验用 STRIPE_WEBHOOK_SECRET(本地用 stripe CLI 的 whsec,线上用 Dashboard 的)。

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    return NextResponse.json({ error: `签名校验失败: ${(e as Error).message}` }, { status: 400 });
  }

  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata ?? {};
    if (!m.order_id) return NextResponse.json({ ok: true, skipped: "no order_id" });

    // 幂等:已经 paid 的订单不重复出票(Stripe 会重试投递)
    const { data: order } = await db.from("orders").select("status").eq("id", m.order_id).single();
    if (order?.status === "pending") {
      await db
        .from("orders")
        .update({ stripe_payment_intent: String(session.payment_intent ?? "") })
        .eq("id", m.order_id);
      await fulfillOrder(db, m.order_id, {
        tierId: m.tier_id!,
        eventId: m.event_id!,
        userId: m.user_id!,
        qty: Number(m.qty ?? 1),
        discountCodeId: null, // used_count 已在免费路径处理;付费路径在此补
      });
      // 补折扣码计数(metadata 没带 code id,从订单读)
      const { data: o2 } = await db.from("orders").select("discount_code_id").eq("id", m.order_id).single();
      if (o2?.discount_code_id) {
        const { data: c } = await db.from("discount_codes").select("used_count").eq("id", o2.discount_code_id).single();
        if (c) await db.from("discount_codes").update({ used_count: c.used_count + 1 }).eq("id", o2.discount_code_id);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      await db.from("orders").update({ status: "canceled" }).eq("id", orderId).eq("status", "pending");
    }
  }

  return NextResponse.json({ received: true });
}
