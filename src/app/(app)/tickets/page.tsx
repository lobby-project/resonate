import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { COL_TITLE, COL_VENUE } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

// MY TICKETS — 我的电子票(二维码入场)。
// 用带会话的客户端读 tickets:RLS 只放行本人的票,天然安全。
// 二维码服务端生成 data URL,页面零额外请求。
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tickets } = await supabase
    .from("tickets")
    .select(
      `id, code, status, created_at,
       ticket_types ( name, ticket_note ),
       events ( id, ${COL_TITLE}, ${COL_VENUE}, event_date, date_tbd, poster_url )`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (tickets ?? []) as any[];

  // 按"未过期在前、同组按场次时间"排;过期/已用沉底
  const now = Date.now();
  const isPast = (t: any) => {
    const d = t.events?.event_date ? new Date(t.events.event_date).getTime() : Infinity;
    return t.status !== "valid" || (Number.isFinite(d) && d < now - 12 * 3600_000);
  };
  const upcoming = list.filter((t) => !isPast(t));
  const past = list.filter(isPast);

  const withQr = async (arr: any[]) =>
    Promise.all(
      arr.map(async (t) => ({
        ...t,
        qr: await QRCode.toDataURL(t.code, {
          margin: 1,
          width: 380,
          color: { dark: "#000000", light: "#ffffff" },
        }),
      }))
    );
  const upcomingQr = await withQr(upcoming);

  return (
    <div className="screen">
      <div className="backbar">
        <a className="back-btn" href="/profile">←</a>
        <span>MY TICKETS</span>
      </div>

      {list.length === 0 && (
        <div className="tk-empty">
          还没有票。去 <a href="/events" className="green">R◉SELECTED</a> 看看正在售卖的场子。
        </div>
      )}

      {upcomingQr.map((t) => {
        const ev = t.events ?? {};
        const dateLabel = ev.date_tbd
          ? "DATE TBD"
          : ev.event_date
            ? new Date(ev.event_date)
                .toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                .toUpperCase()
            : "";
        return (
          <div className="tk-card" key={t.id}>
            <div className="tk-top">
              <div>
                <div className="tk-event">{ev[COL_TITLE]}</div>
                <div className="tk-meta">
                  {dateLabel}
                  {ev[COL_VENUE] ? ` · ${ev[COL_VENUE]}` : ""}
                </div>
                <div className="tk-tier">{t.ticket_types?.name}</div>
              </div>
              {ev.poster_url && <img className="tk-thumb" src={ev.poster_url} alt="" />}
            </div>
            <div className="tk-tear" aria-hidden>
              <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
            </div>
            <div className="tk-qr-wrap">
              <img className="tk-qr" src={t.qr} alt={`ticket ${t.code}`} />
              <div className="tk-code">{t.code}</div>
              <div className="tk-hint">SHOW AT THE DOOR</div>
            </div>
            {t.ticket_types?.ticket_note && <div className="tk-note">{t.ticket_types.ticket_note}</div>}
          </div>
        );
      })}

      {past.length > 0 && (
        <>
          <div className="tk-section">PAST / USED</div>
          {past.map((t) => {
            const ev = t.events ?? {};
            return (
              <div className="tk-card dead" key={t.id}>
                <div className="tk-top">
                  <div>
                    <div className="tk-event">{ev[COL_TITLE]}</div>
                    <div className="tk-meta">
                      {t.ticket_types?.name} · {t.code} · {String(t.status).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
