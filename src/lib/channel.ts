// 渠道归因:统一清洗 + 浏览器 last-touch 存储。
// cleanRef 是纯函数,client(detail_view/localStorage)和 server(checkout)共用 —— 两侧
// 必须用同一套清洗,否则 analytics_events.metadata.ref 与 orders.channel 对不上。
const KEY = "resonate_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // last-touch 30 天有效

export function cleanRef(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return s || null;
}

// last-touch:有新 ref 才覆盖(没带 ref 的访问不清空旧值)。仅浏览器调用。
export function storeRef(raw: unknown): void {
  const ref = cleanRef(raw);
  if (!ref) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ref, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

// 读 last-touch ref(30 天内有效)。仅浏览器调用。
export function readRef(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { ref, ts } = JSON.parse(raw) as { ref?: unknown; ts?: unknown };
    if (typeof ref !== "string" || typeof ts !== "number") return null;
    if (Date.now() - ts > TTL_MS) return null;
    return cleanRef(ref);
  } catch {
    return null;
  }
}
