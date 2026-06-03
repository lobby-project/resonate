"use server";

import { createClient } from "@/lib/supabase/server";

// Send a message to an event's anonymous chat.
// RLS enforces attendee-only; we also attach the sender's anon_num.
export async function sendEventMessage(eventId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // look up this user's anon number for the event
  const { data: att } = await supabase
    .from("event_attendees")
    .select("anon_num")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!att) throw new Error("Not attending this event");

  const { error } = await supabase.from("event_messages").insert({
    event_id: eventId,
    user_id: user.id,
    anon_num: att.anon_num ?? 0,
    text: body,
  });
  if (error) throw new Error(error.message);
}

// Send a private message within a match (real-name 1-on-1).
export async function sendPrivateMessage(matchId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("private_messages").insert({
    match_id: matchId,
    sender_id: user.id,
    text: body,
  });
  if (error) throw new Error(error.message);
}
