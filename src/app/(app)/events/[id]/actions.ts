"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Toggle going for an event, from the detail page.
export async function toggleGoingDetail(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
}
