import type { SupabaseClient } from "@supabase/supabase-js";
import { COL_TITLE, COL_VENUE } from "@/lib/schemaMap";
import { sendTicketEmail } from "@/lib/email";

const ticketCode = () =>
  "RSN-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

/* 出票 + 自动 going + 计数(免费单和 webhook 共用) */
export async function fulfillOrder(
  db: SupabaseClient,
  orderId: string,
  p: { tierId: string; eventId: string; userId: string; qty: number; discountCodeId: string | null }
) {
  await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);

  const rows = Array.from({ length: p.qty }, () => ({
    order_id: orderId,
    ticket_type_id: p.tierId,
    event_id: p.eventId,
    user_id: p.userId,
    code: ticketCode(),
    status: "valid",
    source: "purchase",
  }));
  await db.from("tickets").insert(rows);

  // 计数(beta 量级下直接读改写;真高并发场景换 rpc 原子自增,记在账上)
  const { data: t } = await db.from("ticket_types").select("quantity_sold").eq("id", p.tierId).single();
  if (t) await db.from("ticket_types").update({ quantity_sold: t.quantity_sold + p.qty }).eq("id", p.tierId);

  if (p.discountCodeId) {
    const { data: c } = await db.from("discount_codes").select("used_count").eq("id", p.discountCodeId).single();
    if (c) await db.from("discount_codes").update({ used_count: c.used_count + 1 }).eq("id", p.discountCodeId);
  }

  // 自动 going → 进同场 swipe 池(幂等:已 going 不重复插)
  const { data: existing } = await db
    .from("event_attendees")
    .select("event_id")
    .eq("event_id", p.eventId)
    .eq("user_id", p.userId)
    .maybeSingle();
  if (!existing) {
    await db.from("event_attendees").insert({ event_id: p.eventId, user_id: p.userId });
  }

  // 确认邮件(尽力而为:失败只记日志,绝不让出票链路因为邮件挂掉)
  try {
    const [{ data: ev }, { data: tt }, { data: userRes }] = await Promise.all([
      db.from("events").select(`${COL_TITLE}, ${COL_VENUE}, event_date`).eq("id", p.eventId).single(),
      db.from("ticket_types").select("ticket_note").eq("id", p.tierId).single(),
      db.auth.admin.getUserById(p.userId),
    ]);
    const email = userRes?.user?.email;
    if (email && ev) {
      await sendTicketEmail({
        to: email,
        eventTitle: (ev as Record<string, string>)[COL_TITLE] ?? "Your event",
        venue: ((ev as Record<string, string | null>)[COL_VENUE] ?? null),
        eventDate: (ev as { event_date: string | null }).event_date,
        codes: rows.map((r) => r.code),
        ticketNote: tt?.ticket_note ?? null,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
      });
    }
  } catch (e) {
    console.error("[fulfill] 邮件环节异常(已忽略):", e);
  }
}
