"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Toggle the current user's "going" status for an event.
export async function toggleGoing(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // already going?
  const { data: existing } = await supabase
    .from("event_attendees")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("event_attendees")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);
  } else {
    // assign an anon_num for this event (count existing + 1)
    const { count } = await supabase
      .from("event_attendees")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    await supabase.from("event_attendees").insert({
      user_id: user.id,
      event_id: eventId,
      status: "going",
      anon_num: (count ?? 0) + 1,
    });

    // funnel: log the going intent (append-only, best-effort; does NOT touch the
    // event_attendees toggle above). Only on going→true.
    await supabase.from("analytics_events").insert({
      event_type: "going",
      event_id: eventId,
      user_id: user.id,
      metadata: { via: "feed" },
    });
  }

  revalidatePath("/events");
}
