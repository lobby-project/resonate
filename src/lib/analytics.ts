import { createClient } from "@/lib/supabase/client";

type LogOpts = { eventId?: string | null; metadata?: Record<string, unknown> | null };

// Best-effort funnel logging from the browser. App routes are auth-gated, so the
// user is always logged in here and RLS `user_id = auth.uid()` passes. Never throws —
// analytics must never break the UX. Server-side events (going) insert inline in
// their server action instead of using this client helper.
export async function logEvent(eventType: string, opts: LogOpts = {}) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return; // not logged in → skip (RLS would block anyway)
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      event_id: opts.eventId ?? null,
      user_id: userId,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // swallow
  }
}
