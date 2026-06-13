import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { COL_TITLE } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

// R◉SELECTED 货架(server component):全部已发布的自办活动,含 TBD/online。
// 放在 events feed 顶部:在 events/page.tsx 的 <EventsFeed/> 上方渲染 <RSelectedShelf/>。
// 没有在售活动时整条隐藏(返回 null)。
export default async function RSelectedShelf() {
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: events } = await db
    .from("events")
    .select(`id, ${COL_TITLE}, poster_url, cover_url, date_tbd, event_date, event_type, location_type`)
    .eq("is_owned", true)
    .eq("status", "published")
    .order("event_date", { ascending: true })
    .limit(12);

  if (!events || events.length === 0) return null;

  return (
    <div className="rshelf">
      <div className="rshelf-h">
        <span className="rshelf-t">
          R <span className="o">◉</span> SELECTED
        </span>
        <span className="rshelf-sub">EXCLUSIVE ON RESONATE</span>
      </div>
      <div className="rshelf-row">
        {(events as any[]).map((e) => {
          const img = e.poster_url || e.cover_url;
          const dateLabel = e.date_tbd
            ? "DATE TBD"
            : e.event_date
              ? new Date(e.event_date)
                  .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  .toUpperCase()
              : "";
          const tag =
            e.location_type === "online" ? "ONLINE" : e.event_type === "rsvp" ? "RSVP" : "BUY";
          return (
            <Link href={`/event/${e.id}`} key={e.id} className="rs-card">
              <div className="rs-media dotgrid">
                {img ? <img src={img} alt={e[COL_TITLE]} /> : <span className="rs-letter">{(e[COL_TITLE] ?? "R")[0]}</span>}
              </div>
              <div className="rs-body">
                <div className="rs-name">{e[COL_TITLE]}</div>
                <div className="rs-meta">
                  {dateLabel} · <span className="green">{tag}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
