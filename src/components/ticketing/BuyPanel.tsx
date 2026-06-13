"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */

// 自办活动的购票/RSVP 面板。自包含:自己拉 /api/event/[id]/ticketing,
// EventDetail 只需在 is_owned 时渲染 <BuyPanel eventId={ev.id} userName={...} />。
// 视觉沿用产品 tokens(黑底/绿/border),class 在 globals.css 的 TICKETING 区块。

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function BuyPanel({
  eventId,
  userName,
}: {
  eventId: string;
  userName?: string | null;
}) {
  const [data, setData] = useState<any>(null);
  const [tierId, setTierId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [pwyw, setPwyw] = useState("");
  const [name, setName] = useState(userName ?? "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"paid" | "rsvp" | null>(null);
  const params = useSearchParams();

  useEffect(() => {
    const url = applied
      ? `/api/event/${eventId}/ticketing?code=${encodeURIComponent(applied)}`
      : `/api/event/${eventId}/ticketing`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        if (applied) {
          setCodeMsg(
            d?.code_valid
              ? d.tiers?.some((t: any) => t.unlocked)
                ? "✓ 码有效,已解锁隐藏票档"
                : "✓ 码有效,结账时生效"
              : "✗ 码无效或已用完"
          );
          const unlockedTier = d?.tiers?.find((t: any) => t.unlocked && !t.sold_out && !t.ended);
          if (d?.code_valid && unlockedTier) setTierId(unlockedTier.id);
        }
        if (!applied) {
          const firstBuyable = d?.tiers?.find((t: any) => !t.sold_out && !t.not_started && !t.ended);
          if (firstBuyable) setTierId(firstBuyable.id);
        }
      });
  }, [eventId, applied]);

  useEffect(() => {
    if (params.get("purchase") === "success") setDone("paid");
  }, [params]);

  if (!data?.event) return null;
  const ev = data.event;
  const tiers: any[] = data.tiers ?? [];
  const tier = tiers.find((t) => t.id === tierId);

  /* ---- 成功态 ---- */
  if (done === "paid") {
    return (
      <div className="buy-panel">
        <div className="buy-success">
          <div className="bs-big">YOU&apos;RE IN ●</div>
          支付成功,票已出。你已自动加入这场的聊天室和 swipe 池。
          <a href="/tickets" className="bs-link">VIEW MY TICKETS →</a>
        </div>
      </div>
    );
  }
  if (done === "rsvp") {
    return (
      <div className="buy-panel">
        <div className="buy-success">
          <div className="bs-big">RSVP&apos;D ●</div>
          报名成功,你已加入这场的聊天室和 swipe 池。日期锁定/开售时会通知你。
        </div>
      </div>
    );
  }

  /* ---- RSVP 模式 ---- */
  if (ev.event_type === "rsvp") {
    return (
      <div className="buy-panel">
        <div className="bp-head">RSVP</div>
        {err && <div className="bp-err">{err}</div>}
        <button
          className="bp-buy"
          disabled={busy || !ev.sales_open}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const r = await fetch("/api/rsvp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId }),
            });
            const j = await r.json();
            setBusy(false);
            if (!r.ok) return setErr(j.error ?? "失败了,再试一次");
            setDone("rsvp");
          }}
        >
          {busy ? "…" : ev.sales_open ? "RSVP — FREE" : ev.closed_message || "CLOSED"}
        </button>
      </div>
    );
  }

  /* ---- 售票模式 ---- */
  const allDead = tiers.length > 0 && tiers.every((t) => t.sold_out || t.ended || t.not_started);
  const unitCents =
    tier?.pricing_method === "free"
      ? 0
      : tier?.pricing_method === "pwyw"
        ? Math.round(Number(pwyw || 0) * 100)
        : (tier?.price_cents ?? 0);
  const subtotal = unitCents * qty;
  const fee = subtotal > 0 ? Math.round((subtotal * Number(ev.fee_percent ?? 0)) / 100) : 0;

  async function buy() {
    if (!tier) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        tierId: tier.id,
        qty,
        code: (applied ?? code.trim()) || undefined,
        attendeeName: name.trim(),
        attendeePhone: phone.trim() || undefined,
        pwywCents: tier.pricing_method === "pwyw" ? Math.round(Number(pwyw || 0) * 100) : undefined,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "失败了,再试一次");
    if (j.free) return setDone("paid");
    window.location.href = j.url;
  }

  return (
    <div className="buy-panel">
      <div className="bp-head">TICKETS</div>
      {!ev.sales_open && <div className="bp-err">{ev.closed_message || "Sales are closed."}</div>}
      {ev.sales_open && allDead && <div className="bp-err">{ev.soldout_message || "Tickets are sold out."}</div>}
      {err && <div className="bp-err">{err}</div>}

      {tiers.map((t) => {
        const dead = t.sold_out || t.ended || t.not_started;
        return (
          <div
            key={t.id}
            className={"bp-tier " + (tierId === t.id ? "on " : "") + (dead ? "dead" : "")}
            onClick={() => !dead && setTierId(t.id)}
          >
            <div className="bpt-l">
              <div className="bpt-name">
                {t.name}
                {t.unlocked && <span className="rbadge">UNLOCKED</span>}
              </div>
              {t.description && <div className="bpt-desc">{t.description}</div>}
              {t.sale_ends_at && !t.ended && (
                <div className="bpt-desc">until {new Date(t.sale_ends_at).toLocaleDateString()}</div>
              )}
            </div>
            <div className="bpt-r">
              {t.sold_out
                ? "SOLD OUT"
                : t.not_started
                  ? "SOON"
                  : t.ended
                    ? "ENDED"
                    : t.pricing_method === "free"
                      ? "FREE"
                      : t.pricing_method === "pwyw"
                        ? `PWYW${t.min_price_cents ? ` ${$(t.min_price_cents)}+` : ""}`
                        : $(t.price_cents)}
            </div>
          </div>
        );
      })}

      {tier && ev.sales_open && (
        <>
          {tier.pricing_method === "pwyw" && (
            <div className="bp-field">
              <label>YOUR PRICE (USD)</label>
              <input
                type="number"
                min={(tier.min_price_cents ?? 0) / 100}
                step={1}
                value={pwyw}
                placeholder={String(((tier.min_price_cents ?? 0) / 100) || 10)}
                onChange={(e) => setPwyw(e.target.value)}
              />
            </div>
          )}
          <div className="bp-row">
            <div className="bp-field">
              <label>QTY</label>
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {Array.from({ length: ev.ticket_limit_per_order ?? 8 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="bp-field grow">
              <label>NAME AT THE DOOR</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="入场姓名" />
            </div>
          </div>
          {ev.collect_phone && (
            <div className="bp-field">
              <label>PHONE</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}
          <div className="bp-field">
            <label>DISCOUNT / INVITE CODE</label>
            <div className="bp-coderow">
              <input
                type="text"
                value={code}
                placeholder="optional"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                className="bp-apply"
                disabled={!code.trim()}
                onClick={() => {
                  setCodeMsg(null);
                  setApplied(code.trim() || null);
                }}
              >
                APPLY
              </button>
            </div>
            {codeMsg && (
              <div className="bp-codemsg" style={{ color: codeMsg.startsWith("✓") ? "#39FF14" : "#e07070" }}>
                {codeMsg}
              </div>
            )}
          </div>

          {subtotal > 0 && (
            <div className="bp-math">
              <span>
                {qty} × {$(unitCents)}
                {fee > 0 && ` + ${ev.fee_name ?? "Processing"} ${$(fee)}`}
                {code && " − code"}
              </span>
              <span className="green">≈ {$(subtotal + fee)}</span>
            </div>
          )}

          <button className="bp-buy" disabled={busy || !name.trim()} onClick={buy}>
            {busy ? "…" : subtotal === 0 ? "GET FREE TICKET" : "BUY — SECURE CHECKOUT ↗"}
          </button>
          <div className="bp-fine">由 Stripe 安全收款,卡号不经过 Resonate。买票后自动加入这场的聊天室和 swipe 池。</div>
        </>
      )}

      {ev.refund_policy && (
        <div className="bp-policy">
          <div className="bp-head" style={{ marginBottom: 6 }}>
            REFUND POLICY
          </div>
          {ev.refund_policy}
        </div>
      )}
    </div>
  );
}
